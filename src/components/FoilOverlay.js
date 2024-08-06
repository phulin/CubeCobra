import React, { ComponentProps, ElementType } from 'react';

import Card from 'datatypes/Card';

const FoilOverlay =
  (Tag) =>
  ({ wrapperTag, ...props }) => {
    let finish = 'Non-foil';
    if (Object.hasOwnProperty.call(props, 'finish')) {
      finish = props.finish;
    } else if (Object.hasOwnProperty.call(props, 'card') && Object.hasOwnProperty.call(props.card, 'finish')) {
      finish = props.card.finish;
    }

    const WrapperTag = wrapperTag ?? 'div';
    return (
      <WrapperTag className="position-relative">
        {finish === 'Foil' && (
          <img src="/content/foilOverlay.png" className="foilOverlay card-border" width="100%" alt="Foil overlay" />
        )}
        <Tag {...props} />
      </WrapperTag>
    );
  };

export default FoilOverlay;
