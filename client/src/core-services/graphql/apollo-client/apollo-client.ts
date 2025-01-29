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
        return Promise.reject(response.status);
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

const getBaseUrl = (env: string) => {
  switch (env) {
    case 'Production':
      return process.env.REACT_APP_GRAPHQL_HOST_PORD;
    default:
      return process.env.REACT_APP_GRAPHQL_HOST_LOCAL;
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
          reject('No token received');
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

const UploadLink = createUploadLink({
  uri: getBaseUrl(process.env.REACT_APP_ENV || 'Local'),
  fetch: customFetch,
});

const UploadLinkLocal = createUploadLink({
  uri: process.env.REACT_APP_API_HOST_LOCAL,
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
