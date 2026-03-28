declare module "pg" {
  export class Pool {
    constructor(config?: { connectionString?: string });
    connect(): Promise<{
      query: (text: string, params?: unknown[]) => Promise<{ rowCount: number; rows: any[] }>;
      release: () => void;
    }>;
    query(text: string, params?: unknown[]): Promise<{ rowCount: number; rows: any[] }>;
  }
}
