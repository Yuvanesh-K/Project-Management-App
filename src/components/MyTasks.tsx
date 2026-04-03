import React from 'react';
import TaskBoard from './TaskBoard';

const MyTasks: React.FC = () => {
  return (
    <div className="p-8">
      <TaskBoard myTasksOnly={true} />
    </div>
  );
};

export default MyTasks;
