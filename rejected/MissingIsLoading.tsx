// withLoading adds isLoading to the props: forgetting it is a type error.
// expects: Property 'isLoading' is missing in type '{ name: string; }'
import { ProtectedProfile } from "../src/ui";
const el = <ProtectedProfile name="Ada" />;
