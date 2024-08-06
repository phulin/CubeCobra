import React, { useCallback, useContext } from 'react';

import CubeContext from 'contexts/CubeContext';
import Card, { BoardType } from 'datatypes/Card';

const withGroupModal =
  (Tag) =>
  ({ children, className, altClick, modalProps, ...props }) => {
    const { setModalSelection, setModalOpen } = useContext(CubeContext);
    const handleClick = useCallback(
      (event) => {
        if (altClick && event.ctrlKey) {
          altClick();
        } else {
          event.preventDefault();
          setModalSelection(modalProps.cards.map((card) => ({ board: card.board, index: card.index })));
          setModalOpen(true);
        }
      },
      [altClick, modalProps.cards, setModalOpen, setModalSelection],
    );

    return (
      <>
        <Tag {...props} className={className ? `${className} clickable` : 'clickable'} onClick={handleClick}>
          {children}
        </Tag>
      </>
    );
  };

export default withGroupModal;
