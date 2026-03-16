import { withAuth } from "next-auth/middleware";

export default withAuth({
  pages: {
    signIn: "/login",
  },
});

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/api/devedores/:path*",
    "/api/dividas/:path*",
    "/api/whatsapp/:path*",
  ]
};
