package apitest

import (
	"context"
	"lack-client/pkg/targets/testapi"
)

// TestConnection executes an API connection test.
func TestConnection(ctx context.Context, req Request) Response {
	if ctx == nil {
		ctx = context.Background()
	}
	
	testapiReq := testapi.Request{
		BaseURL:        req.BaseURL,
		RequestHeaders: req.RequestHeaders,
		RequestBody:    req.RequestBody,
		Method:         req.Method,
		TimeoutMs:      req.TimeoutMs,
	}
	
	testapiResp := testapi.DoTest(ctx, testapiReq)
	
	return Response{
		Success:      testapiResp.Success,
		StatusCode:   testapiResp.StatusCode,
		ResponseBody: testapiResp.ResponseBody,
		ResponseTime: testapiResp.ResponseTime,
		Error:        testapiResp.Error,
		Headers:      testapiResp.Headers,
	}
}
