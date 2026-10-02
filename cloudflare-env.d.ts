declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    BUCKET?: R2Bucket;
    LUNCH_ADMIN_CODE?: string;
  }
}
