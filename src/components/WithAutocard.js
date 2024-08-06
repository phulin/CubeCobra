import React, { ElementType, forwardRef, ReactNode, useContext } from 'react';

import AutocardContext from 'contexts/AutocardContext';
import DisplayContext from 'contexts/DisplayContext';
import Card from 'datatypes/Card';

const withAutocard = (Tag) =>
  forwardRef(({ card, image, inModal, ...props }, ref) => {
    const { showCustomImages } = useContext(DisplayContext);
    const { showCard, hideCard } = useContext(AutocardContext);

    if (image) {
      return (
        <Tag
          ref={ref}
          onMouseEnter={() => showCard({ details: { image_normal: image } }, inModal, showCustomImages)}
          onMouseLeave={() => hideCard()}
          {...props}
        />
      );
    }

    return (
      <Tag
        ref={ref}
        onMouseEnter={() => showCard(card, inModal, showCustomImages)}
        onMouseLeave={() => hideCard()}
        {...props}
      />
    );
  });

export default withAutocard;
