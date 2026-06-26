export interface TargetFormData {
  name: string
  description: string
  base_url: string
  api_token: string
  project_id: string
  request_headers: string
  request_body_template: string
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
