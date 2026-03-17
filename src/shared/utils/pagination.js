const DEFAULT_COLLECTION_KEYS = [
  "data",
  "items",
  "results",
  "rows",
  "usuarios",
  "empleados",
  "clientes",
  "roles",
  "productos",
  "proveedores",
  "servicios",
  "membresias",
  "ventas",
  "pedidos",
  "seguimientos",
  "asistencias",
];

export const DEFAULT_PAGINATED_PAGE_SIZE = 5;

const toPositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const pickFirstPositiveInt = (...values) => {
  for (const value of values) {
    const parsed = toPositiveInt(value);
    if (parsed !== null) return parsed;
  }
  return null;
};

const extractArrayFromSource = (source, keys) => {
  if (Array.isArray(source)) return source;
  if (!source || typeof source !== "object") return [];

  for (const key of keys) {
    if (Array.isArray(source?.[key])) {
      return source[key];
    }
  }

  if (source.data && typeof source.data === "object" && !Array.isArray(source.data)) {
    return extractArrayFromSource(source.data, keys);
  }

  return [];
};

export const buildEndpointWithQuery = (endpoint, query = {}) => {
  const entries = Object.entries(query || {}).filter(
    ([, value]) => value !== undefined && value !== null && value !== ""
  );

  if (entries.length === 0) return endpoint;

  const [path, existingQuery = ""] = String(endpoint).split("?");
  const params = new URLSearchParams(existingQuery);

  entries.forEach(([key, value]) => {
    params.set(key, String(value));
  });

  const queryString = params.toString();
  return queryString ? `${path}?${queryString}` : path;
};

export const withPaginationQueryAliases = (query = {}) => {
  const normalizedQuery =
    query && typeof query === "object" && !Array.isArray(query) ? { ...query } : {};

  const page = pickFirstPositiveInt(
    normalizedQuery.page,
    normalizedQuery.pagina,
    normalizedQuery.currentPage,
    normalizedQuery.pageNumber
  );
  const limit = pickFirstPositiveInt(
    normalizedQuery.limit,
    normalizedQuery.pageSize,
    normalizedQuery.perPage,
    normalizedQuery.per_page,
    normalizedQuery.size
  );

  if (page === null || limit === null) {
    return normalizedQuery;
  }

  const offset = Math.max(0, (page - 1) * limit);

  return {
    ...normalizedQuery,
    page,
    limit,
    pagina: page,
    currentPage: page,
    pageNumber: page,
    pageSize: limit,
    perPage: limit,
    per_page: limit,
    size: limit,
    offset,
    skip: offset,
  };
};

export const hasExplicitPaginationInfo = (response) => {
  const containerSources = [
    response?.meta,
    response?.pagination,
    response?.pageInfo,
    response?.data?.meta,
    response?.data?.pagination,
  ].filter(Boolean);

  const inlineSources = [
    response?.data && !Array.isArray(response.data) ? response.data : null,
    response && !Array.isArray(response) ? response : null,
  ].filter(Boolean);

  const hasContainerPagination = containerSources.some(
    (source) => Object.keys(source || {}).length > 0
  );

  const hasInlinePagination = inlineSources.some((source) => {
    const hasPage =
      pickFirstPositiveInt(
        source?.page,
        source?.currentPage,
        source?.pageNumber,
        source?.pagina,
        source?.paginaActual
      ) !== null;
    const hasLimit =
      pickFirstPositiveInt(
        source?.limit,
        source?.pageSize,
        source?.perPage,
        source?.per_page,
        source?.size
      ) !== null;
    const hasTotals =
      pickFirstPositiveInt(
        source?.totalItems,
        source?.total_items,
        source?.total,
        source?.count,
        source?.totalCount,
        source?.itemsCount,
        source?.totalPages,
        source?.total_pages,
        source?.pages,
        source?.lastPage,
        source?.last_page
      ) !== null;

    return hasPage && (hasLimit || hasTotals);
  });

  return hasContainerPagination || hasInlinePagination;
};

export const extractPaginatedItems = (
  response,
  preferredKeys = DEFAULT_COLLECTION_KEYS
) => {
  const keys = Array.from(new Set([...preferredKeys, ...DEFAULT_COLLECTION_KEYS]));
  return extractArrayFromSource(response, keys);
};

export const mapPaginatedCollectionResponse = (
  response,
  mapper,
  {
    preferredKeys = DEFAULT_COLLECTION_KEYS,
    preserveResponseShape = false,
  } = {}
) => {
  const items = extractPaginatedItems(response, preferredKeys).map((item, index) =>
    mapper(item, index)
  );

  if (!preserveResponseShape) return items;
  if (Array.isArray(response)) return items;
  if (!response || typeof response !== "object") return items;

  const keys = Array.from(new Set([...preferredKeys, ...DEFAULT_COLLECTION_KEYS]));

  for (const key of keys) {
    if (Array.isArray(response?.[key])) {
      return { ...response, [key]: items };
    }
  }

  if (
    response.data &&
    typeof response.data === "object" &&
    !Array.isArray(response.data)
  ) {
    for (const key of keys) {
      if (Array.isArray(response.data?.[key])) {
        return {
          ...response,
          data: {
            ...response.data,
            [key]: items,
          },
        };
      }
    }
  }

  return {
    ...response,
    data: items,
  };
};

export const normalizePaginatedResponse = (
  response,
  {
    preferredKeys = DEFAULT_COLLECTION_KEYS,
    defaultPage = 1,
    defaultLimit = DEFAULT_PAGINATED_PAGE_SIZE,
  } = {}
) => {
  const items = extractPaginatedItems(response, preferredKeys);
  const sources = [
    response?.meta,
    response?.pagination,
    response?.pageInfo,
    response?.data?.meta,
    response?.data?.pagination,
    response?.data,
    response,
  ].filter(Boolean);

  const page =
    pickFirstPositiveInt(
      ...sources.flatMap((source) => [
        source?.page,
        source?.currentPage,
        source?.pageNumber,
        source?.pagina,
        source?.paginaActual,
      ])
    ) ?? defaultPage;

  const requestedLimit =
    pickFirstPositiveInt(
      ...sources.flatMap((source) => [
        source?.limit,
        source?.pageSize,
        source?.perPage,
        source?.per_page,
        source?.size,
      ])
    ) ?? defaultLimit;
  const limit = Math.min(
    DEFAULT_PAGINATED_PAGE_SIZE,
    Math.max(1, requestedLimit || DEFAULT_PAGINATED_PAGE_SIZE)
  );

  const totalItems =
    pickFirstPositiveInt(
      ...sources.flatMap((source) => [
        source?.totalItems,
        source?.total_items,
        source?.total,
        source?.count,
        source?.totalCount,
        source?.itemsCount,
      ])
    ) ?? items.length;

  const totalPages =
    pickFirstPositiveInt(
      ...sources.flatMap((source) => [
        source?.totalPages,
        source?.total_pages,
        source?.pages,
        source?.lastPage,
        source?.last_page,
      ])
    ) ??
    Math.max(1, Math.ceil(totalItems / Math.max(1, limit)));

  return {
    items,
    page,
    limit,
    totalItems,
    totalPages,
  };
};
