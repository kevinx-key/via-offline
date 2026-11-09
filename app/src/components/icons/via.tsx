import styled from 'styled-components';

const LogoImage = styled.img`
  display: block;
  width: auto;
  object-fit: contain;
`;

/**
 * App logo (K-STAR mark). Replaces the original VIA wordmark; the wrapper
 * keeps the same component name/height contract so call sites stay untouched.
 */
export const VIALogo = (props: {
  height?: string | number;
  [key: string]: unknown;
}) => <LogoImage src="/images/logo.png" alt="K-STAR" height={props.height ?? '25px'} />;
