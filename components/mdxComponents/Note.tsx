import { ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className: string;
}

const Note = ({ children, className }: Props) => {
  return (
    <div className={'grid place-content-center'}>
      <div className={'dark:bg-gray-800 bg-gray-100 rounded' + (className ?? '')}>
        <div className={'box-content px-3 py-0'}>{children}</div>
      </div>
    </div>
  );
};

export default Note;
