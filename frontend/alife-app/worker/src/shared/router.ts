export type Middleware = (
  req: Request,
  env: any,
  ctx: any,
  next: () => Promise<Response>
) => Promise<Response>

export type RouteHandler = (
  req: Request,
  env: any,
  ctx: any,
  next?: () => Promise<Response>
) => Promise<Response>

export class Router {
  private routes: Array<{
    method?: string
    pattern: RegExp
    handler: RouteHandler
  }> = []

  private middlewares: Middleware[] = []

  use(middleware: Middleware): this {
    this.middlewares.push(middleware)
    return this
  }

  add(
    method: string | undefined,
    pathPattern: string,
    handler: RouteHandler
  ): this {
    const escaped = pathPattern.replace(/[.+^${}()|[\]\\]/g, '\\$&')
    const regexSource = escaped
      .replace(/:[a-zA-Z0-9_]+/g, '([^/]+)')
      .replace(/\*/g, '(.*)')
    const pattern = new RegExp(`^${regexSource}$`)
    this.routes.push({ method, pattern, handler })
    return this
  }

  get(pathPattern: string, handler: RouteHandler): this {
    return this.add('GET', pathPattern, handler)
  }

  post(pathPattern: string, handler: RouteHandler): this {
    return this.add('POST', pathPattern, handler)
  }

  put(pathPattern: string, handler: RouteHandler): this {
    return this.add('PUT', pathPattern, handler)
  }

  delete(pathPattern: string, handler: RouteHandler): this {
    return this.add('DELETE', pathPattern, handler)
  }

  all(pathPattern: string, handler: RouteHandler): this {
    return this.add(undefined, pathPattern, handler)
  }

  mount(prefix: string, subRouter: Router): this {
    this.all(`${prefix}*`, async (req, env, ctx, next) => {
      return subRouter.handle(req, env, ctx, next)
    })
    return this
  }

  async handle(req: Request, env: any, ctx: any, next?: () => Promise<Response>): Promise<Response> {
    const url = new URL(req.url)
    const pathname = url.pathname

    // Find all matching routes
    const matchingRoutes = this.routes.filter((r) => {
      if (r.method && r.method !== req.method) return false
      return r.pattern.test(pathname)
    })

    let routeIndex = 0

    const executeRoute = async (): Promise<Response> => {
      if (routeIndex < matchingRoutes.length) {
        const match = matchingRoutes[routeIndex++]
        let middlewareIndex = 0

        const executeMiddleware = async (): Promise<Response> => {
          if (middlewareIndex < this.middlewares.length) {
            const mw = this.middlewares[middlewareIndex++]
            return mw(req, env, ctx, executeMiddleware)
          }
          return match.handler(req, env, ctx, executeRoute)
        }

        return executeMiddleware()
      }

      if (next) {
        return next()
      }

      return new Response('Not found', { status: 404 })
    }

    return executeRoute()
  }
}
