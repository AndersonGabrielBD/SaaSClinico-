export interface ResetPasswordRequestResponse {
  sucesso: boolean;
  mensagem: string;
  reset_code?: string;
  user_id?: string;
}

export interface ResetPasswordResponse {
  sucesso: boolean;
  mensagem: string;
}
