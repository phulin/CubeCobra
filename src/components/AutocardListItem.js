import React from 'react';

import CardModalContext from './CardModalContext';

const AutocardListItem = ({ card }) => {
  let { display_image, image_flip, name, tags } = card.details;
  return (
    <CardModalContext.Consumer>
      {openCardModal =>
        <a
          href="#"
          onClick={e => { e.preventDefault(); openCardModal(card) }}
          className={`card-list-item list-group-item autocard ${getCardColorClass(card)}`}
          card={display_image}
          card_flip={image_flip}
          card_tags={tags}
          cardindex={card.index}
        >
          {name}
        </a>
      }
    </CardModalContext.Consumer>
  );
}

export default AutocardListItem;
