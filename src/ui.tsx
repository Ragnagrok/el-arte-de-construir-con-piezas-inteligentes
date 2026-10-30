// Example 3 from the article: higher-order components as combinators.
// The article elides the body of `withAuth` and doesn't define `Spinner` or
// `Perfil` (`Profile` here); the minimal versions below are mine.
import type { ComponentType } from "react";

export const Spinner = () => <p>loading…</p>;

// A combinator that wraps any component and adds
// a spinner while `isLoading` is true.
export const withLoading = <P extends object>(
  Component: ComponentType<P>
): ComponentType<P & { isLoading: boolean }> =>
  ({ isLoading, ...props }) =>
    isLoading
      ? <Spinner />
      : <Component {...(props as P)} />;

// Who is signed in. A stand-in for a real session.
export const session: { user: string | null } = { user: null };

export const withAuth = <P extends object>(
  Component: ComponentType<P>
): ComponentType<P> =>
  (props) =>
    session.user === null
      ? <p>please sign in</p>
      : <Component {...props} />;

export const Profile = ({ name }: { name: string }) => <h1>{name}</h1>;

export const ProtectedProfile = withAuth(withLoading(Profile));
