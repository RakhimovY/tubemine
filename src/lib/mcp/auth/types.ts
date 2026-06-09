export interface AuthProvider {
  authenticate(req: Request, bearerToken?: string): Promise<{ userId: string } | null>
}
