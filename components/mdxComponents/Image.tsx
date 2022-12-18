import NextImage, { ImageProps } from 'next/image';
// https://github.com/vercel/next.js/discussions/19065
const Image = ({ ...rest }: ImageProps) => <NextImage {...rest} loader={customLoader} />;

// opt-out of image optimization, no-op
const customLoader = ({ src }) => {
  return src;
};

export default Image;
