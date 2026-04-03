import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { nanoid } from "nanoid";
import admin from "firebase-admin";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import cors from "cors";
import { Resend } from "resend";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize Firebase Admin
// If running in Cloud Run, it should pick up credentials automatically
if (admin.apps.length === 0) {
  admin.initializeApp({
    projectId: "imperial-tiger-455606-v0",
  });
}

// Use the specific database ID if provided
const firestore = getFirestore(admin.app(), "ai-studio-4376c764-5cba-402c-a7e9-919c3f1d5f1c");

// Initialize Resend
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

async function sendInvitationEmail(name: string, email: string, inviteLink: string, organizationName: string, invitedByName: string) {
  if (!resend) {
    console.warn("Resend API Key not configured. Skipping email send.");
    return false;
  }

  try {
    const { data, error } = await resend.emails.send({
      from: 'Acme <onboarding@resend.dev>', // Resend default for testing
      to: email,
      subject: `You are invited to join ${organizationName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
          <h2 style="color: #4f46e5;">You're Invited!</h2>
          <p>Hello <strong>${name}</strong>,</p>
          <p>You have been invited to join <strong>${organizationName}</strong> by ${invitedByName}.</p>
          <div style="margin: 30px 0;">
            <a href="${inviteLink}" style="background-color: #4f46e5; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold;">Accept Invitation</a>
          </div>
          <p style="color: #666; font-size: 14px;">If the button above doesn't work, copy and paste this link into your browser:</p>
          <p style="color: #666; font-size: 14px; word-break: break-all;">${inviteLink}</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="color: #999; font-size: 12px;">This invitation was sent from your project management application.</p>
        </div>
      `,
    });

    if (error) {
      console.error("Resend API Error:", error);
      throw error;
    }

    console.log(`Email successfully sent to ${email} via Resend. ID: ${data?.id}`);
    return true;
  } catch (error) {
    console.error("Error sending email via Resend:", error);
    throw error;
  }
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Routes
  
  // POST /api/invitations/send
  app.post("/api/invitations/send", async (req, res) => {
    try {
      const { name, email, organizationId, organizationName, invitedBy, invitedByName } = req.body;
      
      if (!name || !email || !organizationId || !invitedBy) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Check for duplicate pending invitation
      const existingInviteQuery = await firestore.collection("invitations")
        .where("email", "==", email.toLowerCase().trim())
        .where("organizationId", "==", organizationId)
        .where("status", "==", "Pending")
        .get();

      const token = nanoid(32);
      let inviteId;

      if (!existingInviteQuery.empty) {
        // Update existing invitation (Resend logic)
        const existingDoc = existingInviteQuery.docs[0];
        inviteId = existingDoc.id;
        await existingDoc.ref.update({
          token,
          invitedBy,
          createdAt: FieldValue.serverTimestamp(),
        });
      } else {
        // Create new invitation
        const invitation = {
          name,
          email: email.toLowerCase().trim(),
          organizationId,
          organizationName,
          role: "member",
          status: "Pending",
          token,
          invitedBy,
          createdAt: FieldValue.serverTimestamp(),
        };
        const inviteRef = await firestore.collection("invitations").add(invitation);
        inviteId = inviteRef.id;
      }
      
      // Send Real Email
      const inviteLink = `${req.headers.origin || process.env.APP_URL || "http://localhost:3000"}/accept-invite?token=${token}`;
      
      let emailSent = false;
      try {
        emailSent = await sendInvitationEmail(name, email, inviteLink, organizationName, invitedByName);
      } catch (emailError) {
        console.error("Failed to send real email, but invitation was saved in DB.");
        // We still return success: true because the invite is in the DB, 
        // but we might want to inform the user that email delivery failed.
      }
      
      console.log("------------------------------------------");
      console.log(`📧 EMAIL ${!existingInviteQuery.empty ? "RESENT" : "SENT"} TO: ${email}`);
      console.log(`Status: ${emailSent ? "Delivered via Resend" : "Failed or Simulated"}`);
      console.log(`Subject: You have been invited to join ${organizationName}`);
      console.log(`Accept here: ${inviteLink}`);
      console.log("------------------------------------------");

      res.json({ 
        success: true, 
        id: inviteId, 
        inviteLink, 
        isResend: !existingInviteQuery.empty,
        emailSent 
      });
    } catch (error) {
      console.error("Error sending invitation:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // GET /api/invitations/accept?token=
  app.get("/api/invitations/accept", async (req, res) => {
    try {
      const { token, userId } = req.query;
      
      if (!token || !userId) {
        return res.status(400).json({ error: "Missing token or userId" });
      }

      const inviteQuery = await firestore.collection("invitations")
        .where("token", "==", token)
        .where("status", "==", "Pending")
        .get();

      if (inviteQuery.empty) {
        return res.status(404).json({ error: "Invalid or expired invitation token" });
      }

      const inviteDoc = inviteQuery.docs[0];
      const inviteData = inviteDoc.data();

      // Check expiration (24 hours)
      const createdAt = inviteData.createdAt.toDate();
      const now = new Date();
      const diffHours = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
      
      if (diffHours > 24) {
        await inviteDoc.ref.update({ status: "Expired" });
        return res.status(400).json({ error: "Invitation token has expired" });
      }

      // Add user to organization
      const batch = firestore.batch();
      
      const mappingId = `${userId}_${inviteData.organizationId}`;
      const mappingRef = firestore.collection("userOrganizationMappings").doc(mappingId);
      
      batch.set(mappingRef, {
        userId,
        organizationId: inviteData.organizationId,
        role: "member",
        joinedAt: FieldValue.serverTimestamp(),
      });

      // Update user's current organization
      const userRef = firestore.collection("users").doc(userId as string);
      batch.update(userRef, {
        currentOrganizationId: inviteData.organizationId
      });

      // Update invitation status
      batch.update(inviteDoc.ref, { status: "Accepted" });

      await batch.commit();

      res.json({ 
        success: true, 
        organizationId: inviteData.organizationId,
        organizationName: inviteData.organizationName 
      });
    } catch (error) {
      console.error("Error accepting invitation:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PUT /api/organization/members/:userId/role
  app.put("/api/organization/members/:userId/role", async (req, res) => {
    try {
      const { userId } = req.params;
      const { organizationId, role, adminId } = req.body;

      if (!userId || !organizationId || !role || !adminId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      // Check if requester is admin/owner
      const adminMapping = await firestore.collection("userOrganizationMappings")
        .doc(`${adminId}_${organizationId}`)
        .get();

      if (!adminMapping.exists || !["admin", "owner"].includes(adminMapping.data()?.role)) {
        return res.status(403).json({ error: "Unauthorized" });
      }

      await firestore.collection("userOrganizationMappings")
        .doc(`${userId}_${organizationId}`)
        .update({ role });

      res.json({ success: true });
    } catch (error) {
      console.error("Error updating role:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  });

  // PUT /api/task-statuses/reorder
  app.put("/api/task-statuses/reorder", async (req, res) => {
    try {
      const { statuses, organizationId } = req.body;

      if (!statuses || !Array.isArray(statuses) || !organizationId) {
        console.error("Missing required fields for task status reorder:", { statuses: !!statuses, organizationId });
        return res.status(400).json({ error: "Missing required fields" });
      }

      console.log(`Reordering ${statuses.length} task statuses for org ${organizationId}`);
      const batch = firestore.batch();
      
      statuses.forEach((status, index) => {
        if (status && status.id) {
          const statusRef = firestore.collection("taskStatuses").doc(status.id);
          batch.set(statusRef, { order: index }, { merge: true });
        }
      });

      await batch.commit();
      console.log("Task status reorder successful");
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering task statuses:", error);
      res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // PUT /api/issue-statuses/reorder
  app.put("/api/issue-statuses/reorder", async (req, res) => {
    try {
      const { statuses, organizationId } = req.body;

      if (!statuses || !Array.isArray(statuses) || !organizationId) {
        console.error("Missing required fields for issue status reorder:", { statuses: !!statuses, organizationId });
        return res.status(400).json({ error: "Missing required fields" });
      }

      console.log(`Reordering ${statuses.length} issue statuses for org ${organizationId}`);
      const batch = firestore.batch();
      
      statuses.forEach((status, index) => {
        if (status && status.id) {
          const statusRef = firestore.collection("issueStatuses").doc(status.id);
          batch.set(statusRef, { order: index }, { merge: true });
        }
      });

      await batch.commit();
      console.log("Issue status reorder successful");
      res.json({ success: true });
    } catch (error) {
      console.error("Error reordering issue statuses:", error);
      res.status(500).json({ error: "Internal server error", details: error instanceof Error ? error.message : String(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
