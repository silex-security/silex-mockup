export default function Link({ href, scroll, prefetch, replace, ...rest }) {
  return <a href={href.startsWith('/') ? '#' + href : href} {...rest} />;
}
