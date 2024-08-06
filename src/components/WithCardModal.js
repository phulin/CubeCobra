import React, { useCallback, useContext } from 'react';

import CubeContext from 'contexts/CubeContext';
import { BoardType } from 'datatypes/Card';

const withCardModal =
  (Tag) =>
  ({ children, className, altClick, modalProps, ...props }) => {
    const { setModalSelection, setModalOpen } = useContext(CubeContext);

    const handleClick = useCallback(
      (event) => {
        if (altClick && event.ctrlKey) {
          altClick();
        } else {
          event.preventDefault();
          setModalSelection({ board: modalProps.card.board, index: modalProps.card.index });
          setModalOpen(true);
        }
      },
      [altClick, modalProps.card, setModalOpen, setModalSelection],
    );

    return (
      <>
        <Tag {...props} className={className ? `${className} clickable` : 'clickable'} onClick={handleClick}>
          {children}
        </Tag>
      </>
    );
  };

export default withCardModal;
