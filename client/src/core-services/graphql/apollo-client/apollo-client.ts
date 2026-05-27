import {
  ApolloProvider,
  ApolloClient,
  InMemoryCache,
  from,
  ApolloLink,
} from '@apollo/client';
import { onError } from '@apollo/client/link/error';
import { stores } from '../../../stores';
import { setContext } from '@apollo/client/link/context';
import { createUploadLink } from 'apollo-upload-client';
import { IpcRendererEvent } from 'electron';
import { getLimsLiteApiBase } from '../../../runtime/lims-lite-bootstrap';
const { ipcRenderer } = window.require('electron');

let apiCount = 0;
const customFetch = async (
  uri: RequestInfo | URL,
  options: any,
): Promise<any> => {
  try {
    apiCount++;
    if (!stores.loading) stores.setLoading(true);
    const response = await fetch(uri, options).then((response) => {
      if (response.status >= 500) {
        apiCount--;
        return Promise.reject(
          new Error(`GraphQL upstream HTTP ${response.status}`),
        );
      }
      if (response) {
        apiCount--;
        if (apiCount == 0) stores.setLoading(false);
      }
      // stores.setLoading(false);
      return response;
    });
    return response;
  } catch (error) {
    stores.setLoading(false);
    return await Promise.reject(error);
  }
};

/** Prefer `REACT_APP_API_HOST_*` — same physical endpoint as Nest `/graphql`; legacy `REACT_APP_GRAPHQL_HOST_*` still works. */
const getGraphqlHttpUri = (env: string): string | undefined => {
  switch (env) {
    case 'Production':
      return (
        process.env.REACT_APP_API_HOST_PORD ||
        process.env.REACT_APP_GRAPHQL_HOST_PORD
      );
    default:
      return (
        process.env.REACT_APP_API_HOST_LOCAL ||
        process.env.REACT_APP_GRAPHQL_HOST_LOCAL
      );
  }
};

const authLink = setContext(async (_, { headers }) => {
  const accessToken = await new Promise<string>((resolve, reject) => {
    ipcRenderer.invoke('read-access-token');
    ipcRenderer.once(
      'send-access-token',
      (_event: IpcRendererEvent, token: string) => {
        if (token) {
          resolve(token);
        } else {
          reject(new Error('No access token stored — sign in again.'));
        }
      },
    );
  });
  return {
    headers: {
      ...headers,
      Authorization: `Bearer ${accessToken}`,
    },
  };
});

const authMiddleware = new ApolloLink((operation, forward) => {
  // add the authorization to the headers
  operation.setContext(({ headers = {} }) => ({
    headers: {
      ...headers,
      Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
    },
  }));
  return forward(operation);
});

const liteApiBase = getLimsLiteApiBase();
const graphqlUri = liteApiBase
  ? `${liteApiBase}/graphql`
  : getGraphqlHttpUri(process.env.REACT_APP_ENV || 'Local') ?? '';

if (
  process.env.NODE_ENV === 'development' &&
  (!graphqlUri || graphqlUri.trim() === '') &&
  !liteApiBase
) {
  console.warn(
    '[Apollo] Missing GraphQL URL — set REACT_APP_API_HOST_LOCAL (e.g. http://localhost:8080/graphql) or REACT_APP_GRAPHQL_HOST_LOCAL in client/.env',
  );
}

const UploadLink = createUploadLink({
  uri: graphqlUri,
  fetch: customFetch,
});

const errorLink = onError(({ graphQLErrors, networkError }) => {
  if (graphQLErrors) {
    graphQLErrors.forEach(({ message, locations, path, extensions }: any) => {
      console.log(
        `[GraphQL error]: Message: ${message}, Location: ${locations}, Path: ${path}`,
      );
      if (extensions && extensions.validation) {
        const firstMessageKey = Object.keys(extensions.validation)[0];
        if (firstMessageKey) {
          alert(extensions.validation[firstMessageKey][0]);
        }
      } else {
        alert('Something went wrong! Please try again.');
      }
    });
  }
  if (networkError) {
    if (networkError.message === 'Failed to fetch') {
      alert('Backend Server is not responding. Please try again later.');
    } else {
      alert(`[Network error]: ${networkError}`);
    }
  }
});

export const client = new ApolloClient({
  link: authLink.concat(from([errorLink, UploadLink])),
  cache: new InMemoryCache(),
});

export { ApolloProvider };
