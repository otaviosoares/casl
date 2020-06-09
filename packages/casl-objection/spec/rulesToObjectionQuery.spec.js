
import { defineAbility } from '@casl/ability'
import Knex from 'knex'
import { Model } from 'objection'
import { rulesToObjectionQuery } from '../src'

const knex = Knex({ client: 'pg' })
Model.knex(knex)

function rulesToQuery(...args) {
  const builder = rulesToObjectionQuery(...args)
  return builder && builder.toKnexQuery().toString()
}

describe('rulesToObjectionQuery', () => {
  it('returns query builder with no where conditions', () => {
    class Post extends Model {
      static tableName = 'posts'
    }
    const ability = defineAbility(can => can('read', 'Post'))
    const query = rulesToQuery(Post.query(), ability, 'read', 'Post')

    expect(query).to.equal('select "posts".* from "posts"')
  })

  it('returns no where conditions if empty `Ability` instance is passed', () => {
    class Post extends Model {
      static tableName = 'posts'
    }
    const ability = defineAbility(() => {})
    const query = rulesToQuery(Post.query(), ability, 'read', 'Post')

    expect(query).to.be.null
  })

  it('returns empty conditions if at least one regular rule does not have conditions', () => {
    class Post extends Model {
      static tableName = 'posts'
    }
    const ability = defineAbility((can) => {
      can('read', 'Post', { author: 123 })
      can('read', 'Post')
    })
    const query = rulesToQuery(Post.query(), ability, 'read', 'Post')

    expect(query).to.equal('select "posts".* from "posts"')
  })

  it('returns whereNot query for inverted rules', () => {
    class Post extends Model {
      static tableName = 'posts'
    }
    const ability = defineAbility((can, cannot) => {
      cannot('read', 'Post', { private: true })
    })
    const query = rulesToQuery(Post.query(), ability, 'read', 'Post')
    expect(query).to.equal('select "posts".* from "posts" where not "private" = true')
  })

  it('returns `null` if at least one inverted rule does not have conditions', () => {
    class Post extends Model {
      static tableName = 'posts'
    }
    const ability = defineAbility((can, cannot) => {
      cannot('read', 'Post', { author: 123 })
      cannot('read', 'Post')
    })
    const query = rulesToQuery(Post.query(), ability, 'read', 'Post')

    expect(query).to.be.null
  })

  it('returns `null` if at least one inverted rule does not have conditions even if direct condition exists', () => {
    class Post extends Model {
      static tableName = 'posts'
    }
    const ability = defineAbility((can, cannot) => {
      can('read', 'Post', { public: true })
      cannot('read', 'Post', { author: 321 })
      cannot('read', 'Post')
    })
    const query = rulesToQuery(Post.query(), ability, 'read', 'Post')

    expect(query).to.be.null
  })

  it('returns non-`null` if there is at least one regular rule after last inverted one without conditions', () => {
    class Post extends Model {
      static tableName = 'posts'
    }
    const ability = defineAbility((can, cannot) => {
      can('read', 'Post', { public: true })
      cannot('read', 'Post', { author: 321 })
      cannot('read', 'Post')
      can('read', 'Post', { author: 123 })
    })
    const query = rulesToQuery(Post.query(), ability, 'read', 'Post')
    expect(query).to.equal('select "posts".* from "posts" where (("author" = 123))')
  })


  it('OR-es conditions for regular rules', () => {
    class Post extends Model {
      static tableName = 'posts'
    }
    const ability = defineAbility((can) => {
      can('read', 'Post', { status: 'draft', createdBy: 'someoneelse' })
      can('read', 'Post', { status: 'published', createdBy: 'me' })
    })
    const query = rulesToQuery(Post.query(), ability, 'read', 'Post')

    expect(query).to.equal('select "posts".* from "posts" where (("status" = \'published\' and "createdBy" = \'me\') or ("status" = \'draft\' and "createdBy" = \'someoneelse\'))')
  })

  it('AND-es conditions for inverted rules', () => {
    class Post extends Model {
      static tableName = 'posts'
    }
    const ability = defineAbility((can, cannot) => {
      can('read', 'Post')
      cannot('read', 'Post', { status: 'draft', createdBy: 'someoneelse' })
      cannot('read', 'Post', { status: 'published', createdBy: 'me' })
    })
    const query = rulesToQuery(Post.query(), ability, 'read', 'Post')
    expect(query).to.equal('select "posts".* from "posts" where not "status" = \'published\' and not "createdBy" = \'me\' and not "status" = \'draft\' and not "createdBy" = \'someoneelse\'')
  })

  it('OR-es conditions for regular rules and AND-es for inverted ones', () => {
    class Post extends Model {
      static tableName = 'posts'
    }
    const ability = defineAbility((can, cannot) => {
      can('read', 'Post', { _id: 'mega' })
      can('read', 'Post', { state: 'draft' })
      cannot('read', 'Post', { private: true })
      cannot('read', 'Post', { state: 'archived' })
    })
    const query = rulesToQuery(Post.query(), ability, 'read', 'Post')
    expect(query).to.equal('select "posts".* from "posts" where not "state" = \'archived\' and not "private" = true and (("state" = \'draft\') or ("_id" = \'mega\'))')
  })

  it('returns empty where if inverted rule with conditions defined before regular rule without conditions', () => {
    class Post extends Model {
      static tableName = 'posts'
    }
    const ability = defineAbility((can, cannot) => {
      can('read', 'Post', { author: 123 })
      cannot('read', 'Post', { private: true })
      can('read', 'Post')
    })
    const query = rulesToQuery(Post.query(), ability, 'read', 'Post')

    expect(query).to.equal('select "posts".* from "posts"')
  })
})
