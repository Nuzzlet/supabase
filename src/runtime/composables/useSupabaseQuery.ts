import type { PostgrestError, PostgrestFilterBuilder, PostgrestTransformBuilder, UnstableGetResult } from '@supabase/postgrest-js'
import type { GenericSchema, GenericTable, GenericView } from '@supabase/supabase-js/dist/module/lib/types'
import type { AsyncDataRequestStatus } from 'nuxt/app'
import { reactive, toRefs, watchEffect, type Ref } from 'vue'
import { useNuxtApp, useSupabaseClient } from '#imports'
import type { Database as ImportedDB } from '#build/types/supabase-database'

type _StrippedPostgrestFilterBuilder<Schema extends GenericSchema, Row extends Record<string, unknown>, Result, RelationName, Relationships > = Omit<PostgrestFilterBuilder< Schema, Row, Result, RelationName, Relationships>, Exclude<keyof PostgrestTransformBuilder<Schema, Row, Result, RelationName, Relationships>, 'order' | 'range' | 'limit'>>

type StrippedPostgrestFilterBuilder<Schema extends GenericSchema, Row extends Record<string, unknown>, Result, RelationName, Relationships > = {
  [K in keyof _StrippedPostgrestFilterBuilder<Schema, Row, Result, RelationName, Relationships>]: PostgrestFilterBuilder<Schema, Row, Result, RelationName, Relationships>[K]
}

export function useSupabaseQuery<
  const Database extends Record<string, GenericSchema> & ImportedDB,
  _single extends boolean = false,
  _count extends 'exact' | 'planned' | 'estimated' | undefined = undefined,
  _limit extends number | undefined = undefined,

  const SchemaName extends string & keyof Database = 'public',
  const Schema extends GenericSchema = Database[SchemaName],
  const RelationName extends string = string & (keyof Database[SchemaName]['Tables'] | keyof Database[SchemaName]['Views']),
  const Relation extends GenericTable | GenericView = RelationName extends keyof Schema['Tables'] ? Schema['Tables'][RelationName] : RelationName extends keyof Schema['Views'] ? Schema['Views'][RelationName] : never,
  const Query extends string = '*',
  ResultOne = UnstableGetResult<Schema, Relation['Row'], RelationName, Relation['Relationships'], Query>,
  _returning = {
    data: Ref<_single extends true ? ResultOne : ResultOne[]>
    error: Ref<PostgrestError>
    status: Ref<AsyncDataRequestStatus>
    count: _count extends undefined ? undefined : Ref<number>
    loadMore: _limit extends undefined ? undefined : (() => Promise<void>)
  },
>(
  relation: RelationName,
  query: Query,
  filter: (builder: StrippedPostgrestFilterBuilder<Schema, Relation['Row'], ResultOne[], RelationName, Relation['Relationships']>) => StrippedPostgrestFilterBuilder<Schema, Relation['Row'], ResultOne[], RelationName, Relation['Relationships']>,
  { single, count, limit, schema }: {
    single?: _single
    count?: _count
    limit?: _limit
    schema?: SchemaName
  } = {},
): Promise<_returning> & _returning {
  const nuxtApp = useNuxtApp()
  const client = useSupabaseClient<Database>()

  const asyncData = reactive({ status: 'idle', data: null, error: null })
  const returning = toRefs(asyncData)

  function makeRequest() {
    const request = schema
      ? client.schema<SchemaName>(schema).from(relation).select(query, { count })
      : client.from(relation).select(query, { count })
    const filteredRequest = filter(request as unknown as StrippedPostgrestFilterBuilder<Schema, Relation['Row'], ResultOne[], RelationName, Relation['Relationships']>) as unknown as PostgrestTransformBuilder<Schema, Relation['Row'], ResultOne[], RelationName, Relation['Relationships']>
    if (single) filteredRequest.single()
    if (limit) filteredRequest.limit(limit)
    return filteredRequest
  }

  const req = makeRequest()
  // @ts-expect-error Property 'url' is protected and only accessible within class 'PostgrestBuilder<Result>' and its subclasses.
  const key = req.url.pathname + req.url.search
  if (import.meta.browser) {
    // Watch for changes
    let reqInProgress: ReturnType<typeof handleRequest>
    watchEffect(async () => {
      if (reqInProgress) await reqInProgress
      reqInProgress = handleRequest(makeRequest())
    })

    // loadMore
    if (limit && !single)
      Object.assign(returning, {
        async loadMore() {
          if (!Array.isArray(asyncData.data)) throw new Error('asyncData.data is not an array, so more values cannot be loaded into it.')
          asyncData.status = 'pending'
          const { data, error, count } = await makeRequest().range(asyncData.data.length, asyncData.data.length + limit)
          Object.assign(asyncData, { error, count })
          asyncData.data.push(data)
          asyncData.status = error ? 'error' : 'success'
        },
      })
  }

  async function handleRequest(request: ReturnType<typeof makeRequest>) {
    asyncData.status = 'pending'
    // @ts-expect-error Property 'url' is protected and only accessible within class 'PostgrestBuilder<Result>' and its subclasses.
    const { data, error, count } = nuxtApp.payload.data[req.url.pathname + req.url.search] || await request
    Object.assign(asyncData, { data, error, count })
    asyncData.status = error ? 'error' : 'success'
    return returning
  }

  const promise = new Promise<typeof returning>(resolve => handleRequest(req).then(resolve))

  if (import.meta.server) {
    promise.finally(() => nuxtApp.payload.data[key] ??= returning)
    nuxtApp.hook('app:created', async () => {
      await promise
    })
  }

  return Object.assign(promise, returning)
}

export interface useSupabaseQueryOptions<
  _single extends boolean = false,
  _count extends 'exact' | 'planned' | 'estimated' | undefined = undefined,
  _limit extends number | undefined = undefined,
  _schema extends string = 'public',
> {
  // immediate?: AsyncDataOptions<unknown>['immediate']
  // deep?: AsyncDataOptions<unknown>['deep']
  // lazy?: AsyncDataOptions<unknown>['lazy']
  // server?: AsyncDataOptions<unknown>['server']
  // watch?: AsyncDataOptions<unknown>['watch']
  single?: _single
  schema?: _schema
  limit?: _limit
  count?: _count
}
