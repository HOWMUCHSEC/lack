package types

// ListResult generic list result type.
type ListResult[T any] struct {
	Items   []T  `json:"items"`
	Total   int  `json:"total"`
	HasMore bool `json:"hasMore"`
}

// NewListResult creates a list result.
func NewListResult[T any](items []T, total int, hasMore bool) ListResult[T] {
	return ListResult[T]{
		Items:   items,
		Total:   total,
		HasMore: hasMore,
	}
}
