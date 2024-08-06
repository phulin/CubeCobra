import React, { RefObject, useEffect, useState } from 'react';

const ImageFallback = ({ src, fallbackSrc, innerRef, ...props }) => {
  const [fallback, setFallback] = useState(false);

  const handleError = () => setFallback(true);

  useEffect(() => setFallback(false), [src]);

  // eslint-disable-next-line jsx-a11y/alt-text
  return <img src={fallback ? fallbackSrc : src} onError={handleError} ref={innerRef} {...props} />;
};

ImageFallback.propTypes = {
  src: PropTypes.string.isRequired,
  fallbackSrc: PropTypes.string.isRequired,
  innerRef: PropTypes.shape({}),
};

ImageFallback.defaultProps = {
  innerRef: null,
};

export default ImageFallback;
