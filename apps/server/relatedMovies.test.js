import { test } from 'node:test';
import assert from 'node:assert/strict';
import { allRelatedTitles, mergeRelatedMovies, mergeSeasons, sameFranchise } from './services/catalogSources.service.js';
import { AdminAnimeModel } from './models/adminAnime.model.js';

const tv = { id: 'tv', title: { english: 'Trinity Seven' }, source: 'NguonC', seasonNumber: 1 };
const movie = (id, name, year, source = 'Anime47') => ({ id, title: { english: name }, year, isMovie: true, source });
test('movies from the same franchise are separate from seasons and combine source duplicates', () => {
  const entries = [
    movie('first', 'Trinity Seven Movie: Eternity Library to Alchemic Girl', 2017),
    movie('first-copy', 'Trinity Seven Movie 1: Eternity Library to Alchemic Girl', 2017, 'NguonC'),
    movie('second', 'Trinity Seven Movie 2: Tenkuu Toshokan to Shinku no Maou', 2019),
    movie('second-copy', 'Trinity Seven Movie 2', null),
    movie('unrelated', 'Trinity Blood Movie', 2017),
    movie('ova', 'Trinity Seven OVA', 2015)
  ];
  const movies = mergeRelatedMovies(tv, entries);
  assert.equal(movies.length, 2);
  assert.deepEqual(movies.map(m=>m.year), [2017,2019]);
  assert.deepEqual(movies.map(m=>m.sources.length), [2,2]);
  assert.equal(mergeSeasons(tv, entries).length, 1);
  assert.equal(sameFranchise(tv, entries[4]), false);
  assert.equal(mergeRelatedMovies(entries[0], [tv, ...entries]).length, 2);
});

test('quick lookup publishes available seasons and shares the full lookup and cache', async t => {
  const anime = { id: 'quick-tv', title: { english: 'Quick Example' }, seasonNumber: 1, source: 'AniDoki' };
  const slow = Promise.withResolvers();
  let slowRequests = 0;
  let hideSeason = false;
  t.mock.method(AdminAnimeModel, 'getAllAnimeOverrides', async () =>
    hideSeason ? new Map([['quick-second', { is_hidden: true }]]) : new Map());
  t.mock.method(globalThis, 'fetch', async url => {
    const { hostname } = new URL(url);
    if (hostname === 'anime47.love') {
      slowRequests++;
      return slow.promise;
    }
    if (hostname === 'phim.nguonc.com') return Response.json({ status: 'success', items: [] });
    assert.equal(hostname, 'phimapi.com');
    return Response.json({ data: { items: [{ slug: 'quick-second', name: 'Quick Example Season 2', type: 'hoathinh' }] } });
  });

  const preview = await allRelatedTitles(anime, { quick: true });
  assert.equal(preview.pending, true);
  assert.deepEqual(preview.seasons.map(season => season.id), ['quick-tv', 'quick-second']);

  const complete = allRelatedTitles(anime);
  slow.resolve(Response.json({ results: [{ slug: 'quick-third', title: 'Quick Example Season 3' }] }));
  assert.deepEqual((await complete).seasons.map(season => season.id), ['quick-tv', 'quick-second', 'anime47-quick-third']);

  hideSeason = true;
  const cached = await allRelatedTitles(anime, { quick: true });
  assert.equal(cached.pending, false);
  assert.deepEqual(cached.seasons.map(season => season.id), ['quick-tv', 'anime47-quick-third']);
  assert.equal(slowRequests, 1);
});
