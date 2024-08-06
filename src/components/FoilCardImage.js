import CardImage, { CardImageProps } from 'components/CardImage';
import FoilOverlay, { FoilOverlayProps } from 'components/FoilOverlay';

const FoilCardImage = FoilOverlay(CardImage);

export default FoilCardImage;
