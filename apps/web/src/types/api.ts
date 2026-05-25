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

export type ApiSuccessResult<Data> = {
  body: ApiSuccessResponse<Data>;
  kind: 'success';
  status: number;
};

export type ApiErrorResult<Details = unknown> = {
  body: ApiErrorResponse<Details>;
  kind: 'api-error';
  status: number;
};

export type ApiStructuredResult<Data, Details = unknown> =
  | ApiSuccessResult<Data>
  | ApiErrorResult<Details>;

export type ApiStartupResult = {
  kind: 'api-starting';
  message: string;
  reason: 'gateway' | 'health-timeout';
  status: number | null;
};

export type ApiNetworkErrorResult = {
  kind: 'network-error';
  message: string;
  status: null;
};

export type ApiMalformedResult = {
  kind: 'malformed-response';
  message: string;
  status: number;
};

export type ApiResult<Data, Details = unknown> =
  | ApiStructuredResult<Data, Details>
  | ApiStartupResult
  | ApiNetworkErrorResult
  | ApiMalformedResult;

export type ValidationIssue = {
  field: string;
  message: string;
};
