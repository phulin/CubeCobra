import React, { useContext } from 'react';

import ImageFallback, { ImageFallbackProps } from 'components/ImageFallback';
import withAutocard, { WithAutocardProps } from 'components/WithAutocard';
import DisplayContext from 'contexts/DisplayContext';
import Card from 'datatypes/Card';

const ImageAutocard = withAutocard(ImageFallback);

const CardImage = ({ card, autocard, className, width, height, ...props }) => {
  const { showCustomImages } = useContext(DisplayContext);
  const imageSrc = (showCustomImages && card.imgUrl) || card.details.image_normal;
  const Tag = autocard ? ImageAutocard : ImageFallback;

  return (
    <Tag
      card={autocard ? card : undefined}
      src={imageSrc}
      fallbackSrc="/content/default_card.png"
      alt={card.details.name}
      width={width || '100%'}
      height={height || 'auto'}
      className={className ? `${className} card-border` : 'card-border'}
      {...props}
    />
  );
};

CardImage.propTypes = {
  card: CardPropType.isRequired,
  autocard: PropTypes.bool,
  className: PropTypes.string,
  width: PropTypes.string,
  height: PropTypes.string,
};

CardImage.defaultProps = {
  autocard: false,
  className: null,
  width: null,
  height: null,
};

export default CardImage;
