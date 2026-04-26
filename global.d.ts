declare namespace NodeJS {
  interface ProcessEnv {
    EXPO_PUBLIC_SUPABASE_URL?: string;
    EXPO_PUBLIC_SUPABASE_ANON_KEY?: string;
    NODE_ENV: 'development' | 'production' | 'test';
  }
}

declare var process: {
  env: NodeJS.ProcessEnv;
};
