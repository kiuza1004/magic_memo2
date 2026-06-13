export const dynamic = "force-static";

export function GET() {
  const body = [
    {
      relation: ["delegate_permission/common.handle_all_urls"],
      target: {
        namespace: "android_app",
        package_name: "com.kiuza1004.mylife",
        sha256_cert_fingerprints: [
          "0A:F5:DD:4E:B5:50:E7:8D:25:F5:32:E2:02:BC:23:C0:AA:2C:E0:DA:2B:FE:81:CA:F1:5C:A0:3E:96:02:ED:E7",
        ],
      },
    },
  ];
  return new Response(JSON.stringify(body), {
    headers: { "content-type": "application/json" },
  });
}
