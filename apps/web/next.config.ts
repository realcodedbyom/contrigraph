import type {NextConfig} from 'next';
const basePath = process.env.NEXT_PUBLIC_APP_BASE_PATH || '';
const config:NextConfig={
  basePath,
  trailingSlash: true,
  poweredByHeader: false,
  images:{unoptimized:true},
  async rewrites(){return [{source:'/api/:path*',destination:`${process.env.API_URL||'http://127.0.0.1:8000'}/:path*`}];}
};
export default config;
