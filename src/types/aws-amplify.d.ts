declare module 'aws-amplify' {
  export const Auth: {
    signIn: (username: string, password: string) => Promise<any>;
    signOut: () => Promise<any>;
    currentAuthenticatedUser: () => Promise<any>;
  };

  export const API: {
    get: (apiName: string, path: string, init?: any) => Promise<any>;
    post: (apiName: string, path: string, init?: any) => Promise<any>;
    put: (apiName: string, path: string, init?: any) => Promise<any>;
    del: (apiName: string, path: string, init?: any) => Promise<any>;
  };
} 