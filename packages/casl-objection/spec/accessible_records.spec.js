import { defineAbility } from '@casl/ability'
import { Model } from 'objection'
import Knex from 'knex'
import { accessibleRecordsPlugin } from '../src'

describe('Accessible Records Plugin', () => {
  class Post extends accessibleRecordsPlugin('Post')(Model) {
    static get tableName() {
      return 'posts'
    }
  }


  const knex = Knex({ client: 'pg' })
  Model.knex(knex)
  let ability

  it('injects `accessibleBy` static method', () => {
    expect(Post.query().accessibleBy).to.be.a('function')
  })

  it('injects `accessibleBy` query method', () => {
    expect(Post.query().findById(1).accessibleBy).to.be.a('function')
    expect(Post.query().findById(1).accessibleBy).to.equal(Post.query().accessibleBy)
  })

  describe('`accessibleBy` method', () => {
    beforeEach(() => {
      ability = defineAbility((can) => {
        can('read', 'Post', { state: 'draft' })
        can('update', 'Post', { state: 'published' })
      })

      spy.on(ability, 'rulesFor')
    })

    it('creates query from ability and `read` action by default', () => {
      Post.query().accessibleBy(ability)
      expect(ability.rulesFor).to.have.been.called.with.exactly('read', Post.name)
    })

    it('creates query from ability and specified action', () => {
      Post.query().accessibleBy(ability, 'delete')
      expect(ability.rulesFor).to.have.been.called.with.exactly('delete', Post.name)
    })

    it('does not change query return type', () => {
      const originalType = Post.query().findById(1).op
      const type = Post.query().findById(1).accessibleBy(ability).op

      expect(type).to.equal(originalType)
    })

    it('properly merges result with existing in query `$and` conditions', () => {
      const query = Post.query()
        .where({ prop: true, anotherProp: false })
        .accessibleBy(ability)
        .toKnexQuery()
        .toString()
      expect(query).to.equal('select "posts".* from "posts" where "prop" = true and "anotherProp" = false and (("state" = \'draft\'))')
    })

    describe('when ability disallow to perform an action', () => {
      let query

      beforeEach(() => {
        query = Post.query().accessibleBy(ability, 'notAllowedAction')
      })

      it('adds non-existing property check to conditions for other callback based cases', async () => {
        expect(query.toKnexQuery().toString()).to.equal('select "posts".* from "posts" where "__forbiddenByCasl__" = 1')
      })

      it('returns empty array for collection request', async () => {
        const items = await query

        expect(items).to.be.an('array').that.is.empty
      })
    })
  })
})
