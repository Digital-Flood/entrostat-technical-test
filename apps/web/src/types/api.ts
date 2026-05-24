export type ApiErrorBody<Details = unknown> = {
  code: string;
  details?: Details;
  message: string;
};

export type ApiErrorResponse<Details = unknown> = {
  ok: false;
  error: ApiErrorBody<Details>;
};

export type ApiSuccessResponse<Data> = {
  ok: true;
  data: Data;
};

export type ApiResponse<Data, Details = unknown> =
  | ApiSuccessResponse<Data>
  | ApiErrorResponse<Details>;

export type ApiResult<Data, Details = unknown> = {
  body: ApiResponse<Data, Details>;
  status: number;
};

export type ValidationIssue = {
  field: string;
  message: string;
};
