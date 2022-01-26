import NextImage, { ImageProps } from 'next/image';

const Image = ({ ...rest }: ImageProps) => <NextImage {...rest} loader={customLoader} />;

// opt-out of image optimization, no-op
const customLoader = ({ src }) => {
  return src;
};

export default Image;
