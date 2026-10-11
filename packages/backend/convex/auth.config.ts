export default {
  providers: [
    {
      // CONVEX_SITE_URL is provided automatically by the deployment.
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
