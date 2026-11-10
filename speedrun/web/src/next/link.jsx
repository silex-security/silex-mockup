import { GYM_HOME, isGymPath } from '../gym.js';

/* A link to this app's Agent Gym pages opens the console's Gym in the top window. */
export default function Link({ href, scroll, prefetch, replace, ...rest }) {
  if (isGymPath(href.split(/[?#]/)[0])) return <a href={GYM_HOME} target="_top" {...rest} />;
  return <a href={href.startsWith('/') ? '#' + href : href} {...rest} />;
}
