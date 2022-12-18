import { useState, useRef, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className: string;
}

const Note = ({ children, className }: Props) => {
  return (
    <div className={'pl-2 border-l-4 dark:bg-gray-800 bg-gray-100 ' + (className ?? '')}>
      {children}
    </div>
  );
};

export default Note;
