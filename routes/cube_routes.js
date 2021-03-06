const express = require('express');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const serialize = require('serialize-javascript');
const mergeImages = require('merge-images');
const RSS = require('rss');
const { Canvas, Image } = require('canvas');

Canvas.Image = Image;

const React = require('react');
const ReactDOMServer = require('react-dom/server');

const {
  addAutocard,
  generatePack,
  sanitize,
  setCubeType,
  cardsAreEquivalent,
  getBasics,
  generate_short_id,
  build_id_query,
  get_cube_id,
  addCardHtml,
  removeCardHtml,
  replaceCardHtml,
  abbreviate,
  insertComment,
  getOwnerFromComment,
  saveEdit,
  build_tag_colors,
  maybeCards,
  getElo,
} = require('../serverjs/cubefn.js');
const analytics = require('../serverjs/analytics.js');
const draftutil = require('../dist/utils/draftutil.js');
const cardutil = require('../dist/utils/Card.js');
const carddb = require('../serverjs/cards.js');

carddb.initializeCardDb();
const util = require('../serverjs/util.js');
const { GetPrices } = require('../serverjs/prices.js');
const generateMeta = require('../serverjs/meta.js');

const CARD_HEIGHT = 680;
const CARD_WIDTH = 488;
const CSV_HEADER = 'Name,CMC,Type,Color,Set,Collector Number,Status,Finish,Maybeboard,Image URL,Tags';

const router = express.Router();
// Bring in models
const Cube = require('../models/cube');
const Deck = require('../models/deck');
const Blog = require('../models/blog');
const User = require('../models/user');
const Draft = require('../models/draft');
const CardRating = require('../models/cardrating');

const { NODE_ENV } = process.env;

let BulkUploadPage = null;
let CubeDraftPage = null;
let CubeListPage = null;
let CubePlaytestPage = null;
if (NODE_ENV === 'production') {
  BulkUploadPage = require('../dist/components/BulkUploadPage').default;
  CubeDraftPage = require('../dist/components/CubeDraftPage').default;
  CubeListPage = require('../dist/components/CubeListPage').default;
  CubePlaytestPage = require('../dist/components/CubePlaytestPage').default;
}

const { ensureAuth, csrfProtection } = require('./middleware');

router.use(csrfProtection);

// Add Submit POST Route
router.post('/add', ensureAuth, async (req, res) => {
  try {
    if (req.body.name.length < 5 || req.body.name.length > 100) {
      req.flash('danger', 'Cube name should be at least 5 characters long, and shorter than 100 characters.');
      return res.redirect(`/user/view/${req.user.id}`);
    }

    if (util.has_profanity(req.body.name)) {
      req.flash('danger', 'Cube name should not use profanity.');
      return res.redirect(`/user/view/${req.user.id}`);
    }

    const { user } = req;
    const cubes = await Cube.find({
      owner: user._id,
    });

    if (cubes.length >= 24) {
      req.flash(
        'danger',
        'Cannot create a cube: Users can only have 24 cubes. Please delete one or more cubes to create new cubes.',
      );
      return res.redirect(`/user/view/${req.user.id}`);
    }

    const shortID = await generate_short_id();
    let cube = new Cube();
    cube.shortID = shortID;
    cube.name = req.body.name;
    cube.owner = req.user.id;
    cube.cards = [];
    cube.decks = [];
    cube.articles = [];
    const details = carddb.cardFromId(carddb.nameToId['doubling cube'][0]);
    cube.image_uri = details.art_crop;
    cube.image_name = details.full_name;
    cube.image_artist = details.artist;
    cube.description = 'This is a brand new cube!';
    cube.owner_name = user.username;
    cube.date_updated = Date.now();
    cube.updated_string = cube.date_updated.toLocaleString('en-US');
    cube = setCubeType(cube, carddb);
    await cube.save();

    req.flash('success', 'Cube Added');
    return res.redirect(`/cube/overview/${cube.shortID}`);
  } catch (err) {
    return util.handleRouteError(res, req, err, `/user/view/${req.user.id}`);
  }
});

// Add Submit POST Route
router.get('/clone/:id', async (req, res) => {
  try {
    const { user } = req;

    if (!user) {
      req.flash('danger', 'Please log on to clone this cube.');
      return res.redirect(`/cube/list/${req.params.id}`);
    }

    const cubes = await Cube.find({
      owner: user._id,
    });

    if (cubes.length >= 24) {
      req.flash(
        'danger',
        'Cannot clone this cube: Users can only have 24 cubes. Please delete one or more cubes to create new cubes.',
      );
      return res.redirect(`/cube/list/${req.params.id}`);
    }

    const source = await Cube.findOne(build_id_query(req.params.id));

    const shortID = await generate_short_id();
    let cube = new Cube();
    cube.shortID = shortID;
    cube.name = `Clone of ${source.name}`;
    cube.owner = req.user.id;
    cube.cards = source.cards;
    cube.decks = [];
    cube.articles = [];
    cube.image_uri = source.image_uri;
    cube.image_name = source.image_name;
    cube.image_artist = source.image_artist;
    cube.description = source.description;
    cube.owner_name = user.username;
    cube.date_updated = Date.now();
    cube.updated_string = cube.date_updated.toLocaleString('en-US');
    cube = setCubeType(cube, carddb);
    await cube.save();

    req.flash('success', 'Cube Cloned');
    return res.redirect(`/cube/overview/${cube.shortID}`);
  } catch (err) {
    return util.handleRouteError(res, req, err, `/cube/list/${req.params.id}`);
  }
});

// GEt view cube Route
router.get('/view/:id', (req, res) => {
  return res.redirect(`/cube/overview/${req.params.id}`);
});

router.post('/format/add/:id', ensureAuth, async (req, res) => {
  try {
    req.body.html = sanitize(req.body.html);

    const cube = await Cube.findOne(build_id_query(req.params.id));
    let message = '';

    if (req.body.id === -1) {
      if (!cube.draft_formats) {
        cube.draft_formats = [];
      }
      cube.draft_formats.push({
        title: req.body.title,
        multiples: req.body.multiples === 'true',
        html: req.body.html,
        packs: req.body.format,
      });
      message = 'Custom format successfully added.';
    } else {
      cube.draft_formats[req.body.id] = {
        title: req.body.title,
        multiples: req.body.multiples === 'true',
        html: req.body.html,
        packs: req.body.format,
      };
      message = 'Custom format successfully edited.';
    }
    // check pack formats are sane
    const draftcards = cube.cards.map((card) => Object.assign(card, { details: carddb.cardFromId(card.cardID) }));
    if (draftcards.length === 0) {
      throw new Error('Could not create draft: no cards');
    }
    // test format for errors
    const format = draftutil.parseDraftFormat(req.body.format);
    draftutil.checkFormat(format, draftcards);

    await cube.save();
    req.flash('success', message);
    return res.redirect(`/cube/playtest/${req.params.id}`);
  } catch (err) {
    return util.handleRouteError(res, req, err, `/cube/playtest/${req.params.id}`);
  }
});

router.post('/blog/post/:id', ensureAuth, async (req, res) => {
  try {
    req.body.html = sanitize(req.body.html);
    if (req.body.title.length < 5 || req.body.title.length > 100) {
      req.flash('danger', 'Blog title length must be between 5 and 100 characters.');
      return res.redirect(`/cube/blog/${req.params.id}`);
    }

    let cube = await Cube.findOne(build_id_query(req.params.id));

    cube.date_updated = Date.now();
    cube.updated_string = cube.date_updated.toLocaleString('en-US');
    cube = setCubeType(cube, carddb);

    await cube.save();
    const { user } = req;

    if (req.body.id && req.body.id.length > 0) {
      // update an existing blog post
      const blog = await Blog.findById(req.body.id);

      if (blog.owner !== user._id) {
        req.flash('danger', 'Unable to update this blog post: Unauthorized.');
        return res.redirect(`/cube/blog/${req.params.id}`);
      }

      blog.html = req.body.html;
      blog.title = req.body.title;

      await blog.save();

      req.flash('success', 'Blog update successful');
      return res.redirect(`/cube/blog/${req.params.id}`);
    }
    // post new blog
    if (cube.owner !== user._id) {
      req.flash('danger', 'Unable to post this blog post: Unauthorized.');
      return res.redirect(`/cube/blog/${req.params.id}`);
    }

    const blogpost = new Blog();
    blogpost.html = req.body.html;
    blogpost.title = req.body.title;
    blogpost.owner = user._id;
    blogpost.date = Date.now();
    blogpost.cube = cube._id;
    blogpost.dev = 'false';
    blogpost.date_formatted = blogpost.date.toLocaleString('en-US');
    blogpost.username = user.username;
    blogpost.cubename = cube.name;

    await blogpost.save();

    req.flash('success', 'Blog post successful');
    return res.redirect(`/cube/blog/${req.params.id}`);
  } catch (err) {
    return util.handleRouteError(res, req, err, `/cube/blog/${req.params.id}`);
  }
});

router.post(
  '/follow/:id',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    if (!req.user) {
      req.flash('danger', 'Not Authorized');
      res.status(404).send({
        success: 'false',
      });
    }

    const { user } = req;
    const cube = await Cube.findOne(build_id_query(req.params.id));
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.status(404).send({
        success: 'false',
      });
    }

    if (!cube.users_following.includes(user._id)) {
      cube.users_following.push(user._id);
    }
    if (!user.followed_cubes.includes(cube._id)) {
      user.followed_cubes.push(cube._id);
    }

    await user.save();
    await cube.save();

    res.status(200).send({
      success: 'true',
    });
  }),
);

router.post(
  '/unfollow/:id',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    if (!req.user) {
      req.flash('danger', 'Not Authorized');
      res.status(404).send({
        success: 'false',
      });
    }

    const { user } = req;
    const cube = await Cube.findOne(build_id_query(req.params.id));
    if (!cube) {
      req.flash('danger', 'Cube not found');
      res.status(404).send({
        success: 'false',
      });
    }

    while (cube.users_following.includes(user._id)) {
      cube.users_following.splice(cube.users_following.indexOf(user._id), 1);
    }
    while (user.followed_cubes.includes(cube._id)) {
      user.followed_cubes.splice(user.followed_cubes.indexOf(cube._id), 1);
    }

    await user.save();
    await cube.save();

    res.status(200).send({
      success: 'true',
    });
  }),
);

router.post('/feature/:id', ensureAuth, async (req, res) => {
  try {
    const { user } = req;
    if (!util.isAdmin(user)) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/overview/${req.params.id}`);
    }

    const cube = await Cube.findOne(build_id_query(req.params.id));
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect(`/cube/overview/${req.params.id}`);
    }

    cube.isFeatured = true;
    await cube.save();

    req.flash('success', 'Cube updated successfully.');
    return res.redirect(`/cube/overview/${req.params.id}`);
  } catch (err) {
    return util.handleRouteError(res, req, err, `/cube/overview/${req.params.id}`);
  }
});

router.post('/unfeature/:id', ensureAuth, async (req, res) => {
  try {
    const { user } = req;
    if (!util.isAdmin(user)) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/overview/${req.params.id}`);
    }

    const cube = await Cube.findOne(build_id_query(req.params.id));
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.redirect(`/cube/overview/${req.params.id}`);
    }

    cube.isFeatured = false;
    await cube.save();

    req.flash('success', 'Cube updated successfully.');
    return res.redirect(`/cube/overview/${req.params.id}`);
  } catch (err) {
    return util.handleRouteError(res, req, err, `/cube/overview/${req.params.id}`);
  }
});

router.get('/overview/:id', async (req, res) => {
  try {
    const cubeID = req.params.id;
    const cube = await Cube.findOne(build_id_query(cubeID)).lean();

    const admin = util.isAdmin(req.user);
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    const pids = new Set();
    for (const card of cube.cards) {
      card.details = carddb.cardFromId(card.cardID);
      const allVersions = carddb.getIdsFromName(card.details.name) || [];
      card.allDetails = allVersions.map((id) => carddb.cardFromId(id));
      for (const details of card.allDetails) {
        if (details.tcgplayer_id) {
          pids.add(details.tcgplayer_id);
        }
      }
    }

    const userQ = User.findById(cube.owner);
    const blogsQ = Blog.find({
      cube: cube._id,
    }).sort('date');
    const priceDictQ = GetPrices([...pids]);
    const [user, blogs, priceDict] = await Promise.all([userQ, blogsQ, priceDictQ]);

    let totalPriceOwned = 0;
    let totalPricePurchase = 0;
    for (const card of cube.cards) {
      if (!['Not Owned', 'Proxied'].includes(card.status)) {
        let priceOwned = 0;
        if (card.finish === 'Foil') {
          priceOwned = priceDict[`${card.details.tcgplayer_id}_foil`] || 0;
        } else {
          priceOwned = priceDict[card.details.tcgplayer_id] || priceDict[`${card.details.tcgplayer_id}_foil`] || 0;
        }
        totalPriceOwned += priceOwned;
      }

      const allPrices = card.allDetails.map((details) => [
        priceDict[details.tcgplayer_id],
        priceDict[`${details.tcgplayer_id}_foil`],
      ]);
      const allPricesFlat = [].concat(...allPrices).filter((p) => p && p > 0.001);
      if (allPricesFlat.length > 0) {
        totalPricePurchase += Math.min(...allPricesFlat) || 0;
      }
    }

    if (blogs) {
      for (const item of blogs) {
        if (!item.date_formatted) {
          item.date_formatted = item.date.toLocaleString('en-US');
        }
        if (item.html) {
          item.html = addAutocard(item.html, carddb, cube);
        }
      }
      if (blogs.length > 0) {
        blogs.reverse();
      }
    }
    cube.raw_desc = cube.body;
    if (cube.descriptionhtml) {
      cube.raw_desc = cube.descriptionhtml;
      cube.descriptionhtml = addAutocard(cube.descriptionhtml, carddb, cube);
    }

    // Performance
    delete cube.cards;
    delete cube.decks;
    delete cube.draft_formats;
    delete cube.maybe;

    const reactProps = {
      cube,
      cubeID,
      userID: user ? user._id : null,
      loggedIn: !!user,
      canEdit: user && user._id === cube.owner,
      owner: user ? user.username : 'unknown',
      post: blogs ? blogs[0] : null,
      followed: user ? user.followed_cubes.includes(cube._id) : false,
      editorvalue: cube.raw_desc,
      priceOwned: cube.privatePrices || totalPriceOwned,
      pricePurchase: cube.privatePrices || totalPricePurchase,
      admin,
    };

    return res.render('cube/cube_overview', {
      reactProps: serialize(reactProps),
      title: `${abbreviate(cube.name)} - Overview`,
      metadata: generateMeta(
        `Cube Cobra Overview: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/cube/overview/${req.params.id}`,
      ),
      loginCallback: `/cube/overview/${req.params.id}`,
    });
  } catch (err) {
    return util.handleRouteError(res, req, err, `/cube/overview/${req.params.id}`);
  }
});

router.get(
  '/blogsrc/:id',
  util.wrapAsyncApi(async (req, res) => {
    const blog = await Blog.findById(req.params.id);
    res.status(200).send({
      success: 'true',
      src: blog.html,
      title: blog.title,
      body: blog.body,
    });
  }),
);

router.get('/blog/:id', (req, res) => {
  res.redirect(`/cube/blog/${req.params.id}/0`);
});

router.get('/blog/:id/:page', async (req, res) => {
  try {
    const cubeID = req.params.id;
    const cube = await Cube.findOne(build_id_query(cubeID), Cube.LAYOUT_FIELDS).lean();

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    const userQ = User.findById(cube.owner);
    const blogsQ = Blog.find({
      cube: cube._id,
    });
    const [user, blogs] = await Promise.all([userQ, blogsQ]);

    for (const item of blogs) {
      if (!item.date_formatted) {
        item.date_formatted = item.date.toLocaleString('en-US');
      }
      if (item.html) {
        item.html = addAutocard(item.html, carddb, cube);
      }
    }

    const pages = [];
    let blogPage = [];
    if (blogs.length > 0) {
      blogs.reverse();

      let page = parseInt(req.params.page, 10);
      if (Number.isNaN(page)) {
        page = 0;
      }
      blogPage = blogs.slice(page * 10, (page + 1) * 10);
      for (let i = 0; i < blogs.length / 10; i += 1) {
        if (page === i) {
          pages.push({
            url: `/cube/blog/${cubeID}/${i}`,
            content: i + 1,
            active: true,
          });
        } else {
          pages.push({
            url: `/cube/blog/${cubeID}/${i}`,
            content: i + 1,
          });
        }
      }
    }

    const reactProps = {
      cube,
      cubeID,
      canEdit: req.user ? req.user.id === cube.owner : false,
      posts: blogs.length > 0 ? blogPage : blogs,
      pages: blogs.length > 0 ? pages : null,
      userid: user._id,
    };

    return res.render('cube/cube_blog', {
      reactProps: serialize(reactProps),
      title: `${abbreviate(cube.name)} - Blog`,
      metadata: generateMeta(
        `Cube Cobra Blog: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/cube/blog/${req.params.id}`,
      ),
      loginCallback: `/cube/blog/${req.params.id}`,
    });
  } catch (err) {
    return util.handleRouteError(res, req, err, `/cube/overview/${req.params.id}`);
  }
});

router.get('/rss/:id', async (req, res) => {
  try {
    const split = req.params.id.split(';');
    const cubeID = split[0];
    const cube = await Cube.findOne(build_id_query(cubeID));
    const blogs = await Blog.find({
      cube: cube._id,
    })
      .sort('-date')
      .exec();

    const feed = new RSS({
      title: cube.name,
      feed_url: `https://cubecobra.com/cube/rss/${cube.id}`,
      site_url: 'https://cubecobra.com',
    });

    blogs.forEach((blog) => {
      let content = blog.html ? blog.html : blog.content;

      if (blog.changelist) {
        const changeSetElement = `<div class="change-set">${blog.changelist}</div>`;
        if (content) {
          content += changeSetElement;
        } else {
          content = changeSetElement;
        }
      }

      feed.item({
        title: blog.title,
        description: content,
        guid: blog.id,
        date: blog.date,
      });
    });
    res.set('Content-Type', 'text/xml');
    return res.status(200).send(feed.xml());
  } catch (err) {
    return util.handleRouteError(res, req, err, '/404/');
  }
});

router.get('/compare/:idA/to/:idB', async (req, res) => {
  try {
    const { idA } = req.params;
    const { idB } = req.params;

    const cubeAq = Cube.findOne(build_id_query(idA));
    const cubeBq = Cube.findOne(build_id_query(idB));

    const [cubeA, cubeB] = await Promise.all([cubeAq, cubeBq]);

    const pids = new Set();
    [cubeA, cubeB].forEach((cube) => {
      for (const card of cube.cards) {
        card.details = {
          ...carddb.cardFromId(card.cardID),
        };
        if (!card.type_line) {
          card.type_line = card.details.type;
        }
        if (card.details.tcgplayer_id) {
          pids.add(card.details.tcgplayer_id);
        }
      }
    });

    const priceDict = await GetPrices([...pids]);
    [cubeA, cubeB].forEach((cube) => {
      for (const card of cube.cards) {
        if (card.details.tcgplayer_id) {
          if (priceDict[card.details.tcgplayer_id]) {
            card.details.price = priceDict[card.details.tcgplayer_id];
          }
          if (priceDict[`${card.details.tcgplayer_id}_foil`]) {
            card.details.price_foil = priceDict[`${card.details.tcgplayer_id}_foil`];
          }
        }
      }
    });

    const inBoth = [];
    const onlyA = cubeA.cards.slice(0);
    const onlyB = cubeB.cards.slice(0);
    const aNames = onlyA.map((card) => card.details.name);
    const bNames = onlyB.map((card) => card.details.name);

    for (const card of cubeA.cards) {
      if (bNames.includes(card.details.name)) {
        inBoth.push(card);

        onlyA.splice(aNames.indexOf(card.details.name), 1);
        onlyB.splice(bNames.indexOf(card.details.name), 1);

        aNames.splice(aNames.indexOf(card.details.name), 1);
        bNames.splice(bNames.indexOf(card.details.name), 1);
      }
    }

    const allCards = inBoth.concat(onlyA).concat(onlyB);

    const reactProps = {
      cube: cubeA,
      cubeID: idA,
      cubeB,
      cubeBID: idB,
      onlyA: aNames,
      onlyB: bNames,
      both: inBoth.map((card) => card.details.name),
      cards: allCards.map((card, index) => Object.assign(card, { index })),
      defaultTagColors: [...cubeA.tag_colors, ...cubeB.tag_colors],
      defaultShowTagColors: !req.user || !req.user.hide_tag_colors,
      defaultSorts: cubeA.default_sorts,
    };

    return res.render('cube/cube_compare', {
      reactProps: serialize(reactProps),
      title: `Comparing ${cubeA.name} to ${cubeB.name}`,
      metadata: generateMeta(
        'Cube Cobra Compare Cubes',
        `Comparing "${cubeA.name}" To "${cubeB.name}"`,
        cubeA.image_uri,
        `https://cubecobra.com/cube/compare/${idA}/to/${idB}`,
      ),
      loginCallback: `/cube/compare/${idA}/to/${idB}`,
    });
  } catch (err) {
    return util.handleRouteError(res, req, err, '/404/');
  }
});

router.get('/list/:id', async (req, res) => {
  try {
    const fields =
      'cards maybe name owner card_count type tag_colors default_sorts overrideCategory categoryOverride categoryPrefixes';
    const cube = await Cube.findOne(build_id_query(req.params.id), fields).lean();
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    const pids = new Set();
    const cardNames = [];
    const { cards } = cube;
    cards.forEach((card, index) => {
      card.details = {
        ...carddb.cardFromId(card.cardID),
      };
      card.index = index;
      if (!card.type_line) {
        card.type_line = card.details.type;
      }
      if (card.details.tcgplayer_id) {
        pids.add(card.details.tcgplayer_id);
      }
      cardNames.push(card.details.name);
    });

    const priceDict = await GetPrices([...pids]);
    const eloDict = await getElo(cardNames, true);
    for (const card of cards) {
      if (card.details.tcgplayer_id) {
        if (priceDict[card.details.tcgplayer_id]) {
          card.details.price = priceDict[card.details.tcgplayer_id];
        }
        if (priceDict[`${card.details.tcgplayer_id}_foil`]) {
          card.details.price_foil = priceDict[`${card.details.tcgplayer_id}_foil`];
        }
      }
      if (eloDict[card.details.name]) {
        card.details.elo = eloDict[card.details.name];
      }
    }

    const reactProps = {
      cube,
      cubeID: req.params.id,
      canEdit: req.user ? req.user.id === cube.owner : false,
      defaultView: req.query.view || 'table',
      defaultFilterText: req.query.f || '',
      defaultTagColors: cube.tag_colors || [],
      defaultShowTagColors: !req.user || !req.user.hide_tag_colors,
      defaultSorts: cube.default_sorts,
      maybe: maybeCards(cube, carddb),
    };

    return res.render('cube/cube_list', {
      reactHTML: CubeListPage
        ? await ReactDOMServer.renderToString(React.createElement(CubeListPage, reactProps))
        : undefined,
      reactProps: serialize(reactProps),
      cube,
      cubeID: req.params.id,
      activeLink: 'list',
      title: `${abbreviate(cube.name)} - List`,
      metadata: generateMeta(
        `Cube Cobra List: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/cube/list/${req.params.id}`,
      ),
      loginCallback: `/cube/list/${req.params.id}`,
    });
  } catch (err) {
    return util.handleRouteError(res, req, err, `/cube/overview/${req.params.id}`);
  }
});

router.get('/playtest/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(build_id_query(req.params.id)).lean();

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    const userq = User.findById(cube.owner).exec();
    const decksq = Deck.find(
      {
        cube: cube._id,
      },
      '_id name owner username date',
    )
      .sort({
        date: -1,
      })
      .limit(10)
      .exec();

    const [user, decks] = await Promise.all([userq, decksq]);

    delete cube.cards;
    delete cube.decks;
    delete cube.maybe;

    let draftFormats = [];
    // NOTE: older cubes do not have custom drafts
    if (cube.draft_formats) {
      draftFormats = cube.draft_formats
        .sort((a, b) => a.title.localeCompare(b.title)) // sort titles alphabetically
        .map(({ packs, ...format }) => ({
          ...format,
          packs: JSON.parse(packs),
        }));
    }

    const reactProps = {
      cube,
      cubeID: req.params.id,
      canEdit: user._id.equals(cube.owner),
      decks,
      draftFormats,
    };

    return res.render('cube/cube_playtest', {
      reactHTML: CubePlaytestPage
        ? await ReactDOMServer.renderToString(React.createElement(CubePlaytestPage, reactProps))
        : undefined,
      reactProps: serialize(reactProps),
      title: `${abbreviate(cube.name)} - Playtest`,
      metadata: generateMeta(
        `Cube Cobra Playtest: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/cube/playtest/${req.params.id}`,
      ),
      loginCallback: `/cube/playtest/${req.params.id}`,
    });
  } catch (err) {
    return util.handleRouteError(res, req, err, `/cube/overview/${req.params.id}`);
  }
});

router.get('/analysis/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(build_id_query(req.params.id));

    const reactProps = {
      cube,
      cubeID: req.params.id,
      defaultNav: req.query.nav,
      curve: JSON.stringify(analytics.GetCurve(cube.cards, carddb)),
      typeByColor: analytics.GetTypeByColorIdentity(cube.cards, carddb),
      multicoloredCounts: analytics.GetColorIdentityCounts(cube.cards, carddb),
      tokens: analytics.GetTokens(cube.cards, carddb),
    };

    return res.render('cube/cube_analysis', {
      reactProps: serialize(reactProps),
      title: `${abbreviate(cube.name)} - Analysis`,
      metadata: generateMeta(
        `Cube Cobra Analysis: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/cube/analysis/${req.params.id}`,
      ),
      loginCallback: `/cube/analysis/${req.params.id}`,
    });
  } catch (err) {
    return util.handleRouteError(res, req, err, `/cube/overview/${req.params.id}`);
  }
});

router.get('/samplepack/:id', (req, res) => {
  res.redirect(`/cube/samplepack/${req.params.id}/${Date.now().toString()}`);
});

router.get('/samplepack/:id/:seed', async (req, res) => {
  try {
    const cube = await Cube.findOne(build_id_query(req.params.id));
    const pack = await generatePack(req.params.id, carddb, req.params.seed);

    return res.render('cube/cube_samplepack', {
      cube,
      title: `${abbreviate(cube.name)} - Sample Pack`,
      pack: pack.pack,
      seed: pack.seed,
      cubeID: req.params.id,
      activeLink: 'playtest',
      metadata: generateMeta(
        'Cube Cobra Sample Pack',
        `A sample pack from ${cube.name}`,
        `https://cubecobra.com/cube/samplepackimage/${req.params.id}/${pack.seed}.png`,
        `https://cubecobra.com/cube/samplepack/${req.params.id}/${pack.seed}`,
        CARD_WIDTH * 5,
        CARD_HEIGHT * 3,
      ),
      loginCallback: `/cube/samplepack/${req.params.id}`,
    });
  } catch (err) {
    return util.handleRouteError(res, req, err, `/cube/playtest/${req.params.id}`);
  }
});

router.get('/samplepackimage/:id/:seed', async (req, res) => {
  try {
    req.params.seed = req.params.seed.replace('.png', '');
    const pack = await generatePack(req.params.id, carddb, req.params.seed);

    const srcArray = pack.pack.map((card, index) => {
      return {
        src: card.image_normal,
        x: CARD_WIDTH * (index % 5),
        y: CARD_HEIGHT * Math.floor(index / 5),
      };
    });

    return mergeImages(srcArray, {
      width: CARD_WIDTH * 5,
      height: CARD_HEIGHT * 3,
      Canvas,
    }).then((image) => {
      res.writeHead(200, {
        'Content-Type': 'image/png',
      });
      res.end(Buffer.from(image.replace(/^data:image\/png;base64,/, ''), 'base64'));
    });
  } catch (err) {
    return util.handleRouteError(res, req, err, '/404');
  }
});

router.post('/importcubetutor/:id', ensureAuth, async (req, res) => {
  try {
    const cube = await Cube.findOne(build_id_query(req.params.id));
    if (cube.owner !== req.user.id) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/list/${req.params.id}`);
    }
    if (!Number.isInteger(req.body.cubeid)) {
      req.flash('danger', 'Error: Provided ID is not in correct format.');
      return res.redirect(`/cube/list/${req.params.id}`);
    }

    const response = await fetch(`https://www.cubetutor.com/viewcube/${req.body.cubeid}`, {
      headers: {
        // This tricks cubetutor into not redirecting us to the unsupported browser page.
        'User-Agent': 'Mozilla/5.0',
      },
    });
    if (!response.ok) {
      req.flash('danger', 'Error accessing CubeTutor.');
      return res.redirect(`/cube/list${req.params.id}`);
    }
    const text = await response.text();
    const data = cheerio.load(text);

    const tagColors = new Map();
    data('.keyColour').each((i, elem) => {
      const nodeText = elem.firstChild.nodeValue.trim();
      tagColors.set(elem.attribs.class.split(' ')[1], nodeText);
    });

    const cards = [];
    data('.cardPreview').each((i, elem) => {
      const str = elem.attribs['data-image'].substring(37, elem.attribs['data-image'].length - 4);
      const name = decodeURIComponent(elem.children[0].data).replace('_flip', '');
      const tagColorClasses = elem.attribs.class.split(' ').filter((c) => tagColors.has(c));
      const tags = tagColorClasses.map((c) => tagColors.get(c));
      cards.push({
        set: str.includes('/') ? str.split('/')[0] : 'unknown',
        name,
        tags,
      });
    });

    const added = [];
    let missing = '';
    let changelog = '';
    for (const card of cards) {
      const potentialIds = carddb.allIds(card);
      if (potentialIds && potentialIds.length > 0) {
        const matchingSet = potentialIds.find((id) => carddb.cardFromId(id).set.toUpperCase() === card.set);
        const nonPromo = potentialIds.find(carddb.notPromoOrDigitalId);
        const selected = matchingSet || nonPromo || potentialIds[0];
        const details = carddb.cardFromId(selected);
        added.push(details);
        util.addCardToCube(cube, details, card.tags);
        changelog += addCardHtml(details);
      } else {
        missing += `${card.name}\n`;
      }
    }

    const blogpost = new Blog();
    blogpost.title = 'Cubetutor Import - Automatic Post';
    blogpost.html = changelog;
    blogpost.owner = cube.owner;
    blogpost.date = Date.now();
    blogpost.cube = cube._id;
    blogpost.dev = 'false';
    blogpost.date_formatted = blogpost.date.toLocaleString('en-US');
    blogpost.username = cube.owner_name;
    blogpost.cubename = cube.name;

    if (missing.length === 0) {
      const reactProps = {
        cubeID: req.params.id,
        missing,
        added: added.map(({ _id, name, image_normal, image_flip }) => ({ _id, name, image_normal, image_flip })),
        blogpost: blogpost.toObject(),
      };
      return res.render('cube/bulk_upload', {
        reactHTML:
          NODE_ENV === 'production'
            ? await ReactDOMServer.renderToString(React.createElement(BulkUploadPage, reactProps))
            : undefined,
        reactProps: serialize(reactProps),
        cube,
        cubeID: req.params.id,
        title: `${abbreviate(cube.name)} - Bulk Upload`,
      });
    }

    try {
      const blogQ = blogpost.save();
      setCubeType(cube, carddb);
      const cubeQ = cube.save();
      await Promise.all([blogQ, cubeQ]);
      req.flash('success', 'All cards successfully added.');
      return res.redirect(`/cube/list/${req.params.id}`);
    } catch (e) {
      console.error(e);
      req.flash('danger', 'Error adding cards. Please try again.');
      return res.redirect(`/cube/list/${req.params.id}`);
    }
  } catch (err) {
    return util.handleRouteError(res, req, err, `/cube/list/${req.params.id}`);
  }
});

router.post('/uploaddecklist/:id', ensureAuth, async (req, res) => {
  try {
    const cube = await Cube.findOne(build_id_query(req.params.id));
    if (!cube) {
      req.flash('danger', 'Cube not found.');
      return res.redirect('/404');
    }

    if (cube.owner !== req.user.id) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/playtest/${req.params.id}`);
    }

    const cards = req.body.body.match(/[^\r\n]+/g);
    if (!cards) {
      req.flash('danger', 'No cards detected');
      return res.redirect(`/cube/playtest/${req.params.id}`);
    }

    // list of cardids
    const added = [];
    for (let i = 0; i < 16; i++) {
      added.push([]);
    }

    for (let i = 0; i < cards.length; i++) {
      const item = cards[i].toLowerCase().trim();
      if (/([0-9]+x )(.*)/.test(item)) {
        const count = parseInt(item.substring(0, item.indexOf('x')), 10);
        for (let j = 0; j < count; j++) {
          cards.push(item.substring(item.indexOf('x') + 1));
        }
      } else {
        let selected;
        // does not have set info
        const normalizedName = cardutil.normalizeName(item);
        const potentialIds = carddb.getIdsFromName(normalizedName);
        if (potentialIds && potentialIds.length > 0) {
          // TODO: change this to grab a version that exists in the cube
          for (let k = 0; k < cube.cards.length; i++) {
            if (carddb.cardFromId(cube.cards[k].cardID).name_lower === normalizedName) {
              selected = cube.cards[k];
              selected.details = carddb.cardFromId(cube.cards[k].cardID);
            }
          }
          if (!selected) {
            // TODO: get most reasonable card?
            selected = { cardID: potentialIds[0] };
            selected.details = carddb.cardFromId(potentialIds[0]);
          }
        }
        if (selected) {
          // push into correct column.
          let column = Math.min(7, selected.details.cmc);
          if (!selected.details.type.toLowerCase().includes('creature')) {
            column += 8;
          }
          added[column].push(selected);
        }
      }
    }

    const deck = new Deck();
    deck.playerdeck = added;
    deck.owner = req.user._id;
    deck.cube = cube._id;
    deck.date = Date.now();
    deck.bots = [];
    deck.playersideboard = [];
    deck.pickOrder = [];
    deck.newformat = true;
    deck.name = `${req.user.username}'s decklist upload on ${deck.date.toLocaleString('en-US')}`;

    if (!cube.decks) {
      cube.decks = [];
    }
    cube.decks.push(deck._id);

    if (!cube.numDecks) {
      cube.numDecks = 0;
    }
    cube.numDecks += 1;

    await Promise.all([cube.save(), deck.save()]);

    return res.redirect(`/cube/deckbuilder/${deck._id}`);
  } catch (err) {
    return util.handleRouteError(res, req, err, '/404');
  }
});

async function bulkUploadCSV(req, res, cards, cube) {
  const added = [];
  let missing = '';
  let changelog = '';
  for (const cardRaw of cards) {
    const split = util.CSVtoArray(cardRaw);
    const name = split[0];
    const maybeboard = split[8];
    const card = {
      name,
      cmc: split[1],
      type_line: split[2].replace('-', '—'),
      colors: split[3].split('').filter((c) => [...'WUBRG'].includes(c)),
      set: split[4].toUpperCase(),
      addedTmsp: new Date(),
      collector_number: split[5],
      status: split[6],
      finish: split[7],
      imgUrl: split[9] && split[9] !== 'undefined' ? split[9] : null,
      tags: split[10] && split[10].length > 0 ? split[10].split(',') : [],
    };

    const potentialIds = carddb.allIds(card);
    if (potentialIds && potentialIds.length > 0) {
      // First, try to find the correct set.
      const matchingSet = potentialIds.find((id) => carddb.cardFromId(id).set.toUpperCase() === card.set);
      const nonPromo = potentialIds.find(carddb.notPromoOrDigitalId);
      const first = potentialIds[0];
      card.cardID = matchingSet || nonPromo || first;
      if (maybeboard === 'true') {
        cube.maybe.push(card);
      } else {
        cube.cards.push(card);
      }
      changelog += addCardHtml(carddb.cardFromId(card.cardID));
    } else {
      missing += `${card.name}\n`;
    }
  }

  const blogpost = new Blog();
  blogpost.title = 'Cube Bulk Import - Automatic Post';
  blogpost.html = changelog;
  blogpost.owner = cube.owner;
  blogpost.date = Date.now();
  blogpost.cube = cube._id;
  blogpost.dev = 'false';
  blogpost.date_formatted = blogpost.date.toLocaleString('en-US');
  blogpost.username = cube.owner_name;
  blogpost.cubename = cube.name;

  //
  if (missing.length > 0) {
    const reactProps = {
      cubeID: req.params.id,
      missing,
      added: added.map(({ _id, name, image_normal, image_flip }) => ({ _id, name, image_normal, image_flip })),
      blogpost: blogpost.toObject(),
    };
    return res.render('cube/bulk_upload', {
      reactHTML:
        NODE_ENV === 'production'
          ? await ReactDOMServer.renderToString(React.createElement(BulkUploadPage, reactProps))
          : undefined,
      reactProps: serialize(reactProps),
      cube,
      cubeID: req.params.id,
      title: `${abbreviate(cube.name)} - Bulk Upload`,
    });
  }

  try {
    await blogpost.save();
    cube = setCubeType(cube, carddb);
    await Cube.updateOne(
      {
        _id: cube._id,
      },
      cube,
    );
    req.flash('success', 'All cards successfully added.');
    return res.redirect(`/cube/list/${req.params.id}`);
  } catch (err) {
    console.error(err);
    req.flash('danger', 'Error adding cards. Please try again.');
    return res.redirect(`/cube/list/${req.params.id}`);
  }
}

async function bulkUpload(req, res, list, cube) {
  const cards = list.match(/[^\r\n]+/g);
  if (!cards) {
    req.flash('danger', 'Invalid request.');
    return res.redirect(`/cube/list/${req.params.id}`);
  }

  if (cards[0].trim() === CSV_HEADER) {
    cards.splice(0, 1);
    return bulkUploadCSV(req, res, cards, cube);
  }

  cube.date_updated = Date.now();
  cube.updated_string = cube.date_updated.toLocaleString('en-US');
  let missing = '';
  const added = [];
  let changelog = '';
  for (let i = 0; i < cards.length; i++) {
    const item = cards[i].toLowerCase().trim();
    if (/([0-9]+x )(.*)/.test(item)) {
      const count = parseInt(item.substring(0, item.indexOf('x')), 10);
      for (let j = 0; j < count; j++) {
        cards.push(item.substring(item.indexOf('x') + 1));
      }
    } else {
      let selected;
      if (/(.*)( \((.*)\))/.test(item)) {
        // has set info
        if (
          carddb.nameToId[
            item
              .toLowerCase()
              .substring(0, item.indexOf('('))
              .trim()
          ]
        ) {
          const name = item
            .toLowerCase()
            .substring(0, item.indexOf('('))
            .trim();
          const set = item.toLowerCase().substring(item.indexOf('(') + 1, item.indexOf(')'));
          // if we've found a match, and it DOES need to be parsed with cubecobra syntax
          const potentialIds = carddb.nameToId[name];
          selected = potentialIds.find((id) => carddb.cardFromId(id).set.toUpperCase() === set);
        }
      } else {
        // does not have set info
        const potentialIds = carddb.nameToId[item.toLowerCase().trim()];
        if (potentialIds && potentialIds.length > 0) {
          const nonPromo = potentialIds.find(carddb.notPromoOrDigitalId);
          selected = nonPromo || potentialIds[0];
        }
      }
      if (selected) {
        const details = carddb.cardFromId(selected);
        util.addCardToCube(cube, details);
        added.push(details);
        changelog += addCardHtml(details);
      } else {
        missing += `${item}\n`;
      }
    }
  }

  const blogpost = new Blog();
  blogpost.title = 'Cube Bulk Import - Automatic Post';
  blogpost.html = changelog;
  blogpost.owner = cube.owner;
  blogpost.date = Date.now();
  blogpost.cube = cube._id;
  blogpost.dev = 'false';
  blogpost.date_formatted = blogpost.date.toLocaleString('en-US');
  blogpost.username = cube.owner_name;
  blogpost.cubename = cube.name;

  if (missing.length > 0) {
    const reactProps = {
      cubeID: req.params.id,
      missing,
      added: added.map(({ _id, name, image_normal, image_flip }) => ({ _id, name, image_normal, image_flip })),
      blogpost: blogpost.toObject(),
    };
    return res.render('cube/bulk_upload', {
      reactHTML: BulkUploadPage
        ? await ReactDOMServer.renderToString(React.createElement(BulkUploadPage, reactProps))
        : undefined,
      reactProps: serialize(reactProps),
      cube,
      cubeID: req.params.id,
      title: `${abbreviate(cube.name)} - Bulk Upload`,
    });
  }

  try {
    await blogpost.save();
    cube = setCubeType(cube, carddb);
    await Cube.updateOne(
      {
        _id: cube._id,
      },
      cube,
    );
    req.flash('success', 'All cards successfully added.');
    return res.redirect(`/cube/list/${req.params.id}`);
  } catch (err) {
    console.error(err);
    req.flash('danger', 'Error adding cards. Please try again.');
    return res.redirect(`/cube/list/${req.params.id}`);
  }
}

router.post('/bulkupload/:id', ensureAuth, async (req, res) => {
  try {
    const cube = await Cube.findOne(build_id_query(req.params.id));
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }
    if (cube.owner !== req.user.id) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/list/${req.params.id}`);
    }

    return await bulkUpload(req, res, req.body.body, cube);
  } catch (err) {
    return util.handleRouteError(res, req, err, `/cube/list/${req.params.id}`);
  }
});

router.post('/bulkuploadfile/:id', ensureAuth, async (req, res) => {
  try {
    if (!req.files) {
      req.flash('danger', 'Please attach a file');
      return res.redirect(`/cube/list/${req.params.id}`);
    }

    const items = req.files.document.data.toString('utf8'); // the uploaded file object

    const cube = await Cube.findOne(build_id_query(req.params.id));
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }
    if (cube.owner !== req.user.id) {
      req.flash('danger', 'Not Authorized');
      return res.redirect(`/cube/list/${req.params.id}`);
    }

    return await bulkUpload(req, res, items, cube);
  } catch (err) {
    return util.handleRouteError(res, req, err, `/cube/list/${req.params.id}`);
  }
});

router.get('/download/cubecobra/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(build_id_query(req.params.id));

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const card of cube.cards) {
      res.write(`${carddb.cardFromId(card.cardID).full_name}\r\n`);
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(res, req, err, '/404');
  }
});

router.get('/download/csv/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(build_id_query(req.params.id));

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.csv`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write(`${CSV_HEADER}\r\n`);
    const writeCard = (card, maybe) => {
      if (!card.type_line) {
        card.type_line = carddb.cardFromId(card.cardID).type;
      }
      let { name } = carddb.cardFromId(card.cardID);
      while (name.includes('"')) {
        name = name.replace('"', '-quote-');
      }
      while (name.includes('-quote-')) {
        name = name.replace('-quote-', '""');
      }
      let { imgUrl } = card;
      if (imgUrl) {
        imgUrl = `"${imgUrl}"`;
      } else {
        imgUrl = '';
      }
      res.write(`"${name}",`);
      res.write(`${card.cmc},`);
      res.write(`"${card.type_line.replace('—', '-')}",`);
      res.write(`${card.colors.join('')},`);
      res.write(`"${carddb.cardFromId(card.cardID).set}",`);
      res.write(`"${carddb.cardFromId(card.cardID).collector_number}",`);
      res.write(`${card.status},`);
      res.write(`${card.finish},`);
      res.write(`${maybe},`);
      res.write(`${imgUrl},"`);
      card.tags.forEach((tag, tagIndex) => {
        if (tagIndex !== 0) {
          res.write(', ');
        }
        res.write(tag);
      });
      res.write('"\r\n');
    };
    for (const card of cube.cards) {
      return writeCard(card, false);
    }
    for (const card of cube.maybe) {
      return writeCard(card, true);
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(res, req, err, '/404');
  }
});

router.get('/download/forge/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(build_id_query(req.params.id));

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    res.write('[metadata]\r\n');
    res.write(`Name=${cube.name}\r\n`);
    res.write('[Main]\r\n');
    for (const card of cube.cards) {
      const { name } = carddb.cardFromId(card.cardID);
      const { set } = carddb.cardFromId(card.cardID);
      res.write(`1 ${name}|${set.toUpperCase()}\r\n`);
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(res, req, err, '/404');
  }
});

router.get('/download/xmage/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(build_id_query(req.params.id));

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.dck`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const card of cube.cards) {
      const { name } = carddb.cardFromId(card.cardID);
      const { set } = carddb.cardFromId(card.cardID);
      const collectorNumber = carddb.cardFromId(card.cardID).collector_number;
      res.write(`1 [${set.toUpperCase()}:${collectorNumber}] ${name}\r\n`);
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(res, req, err, '/404');
  }
});

router.get('/download/plaintext/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(build_id_query(req.params.id));

    res.setHeader('Content-disposition', `attachment; filename=${cube.name.replace(/\W/g, '')}.txt`);
    res.setHeader('Content-type', 'text/plain');
    res.charset = 'UTF-8';
    for (const card of cube.cards) {
      res.write(`${carddb.cardFromId(card.cardID).name}\r\n`);
    }
    return res.end();
  } catch (err) {
    return util.handleRouteError(res, req, err, '/404');
  }
});

router.post('/startdraft/:id', async (req, res) => {
  try {
    const cube = await Cube.findOne(build_id_query(req.params.id), '_id name draft_formats card_count type cards');

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    const params = {
      id: parseInt(req.body.id, 10), // < 0 is standard draft, otherwise custom draft
      seats: parseInt(req.body.seats, 10),
      packs: parseInt(req.body.packs, 10),
      cards: parseInt(req.body.cards, 10),
    };

    // setup draft
    const draftcards = cube.cards.map((card) => Object.assign(card, { details: carddb.cardFromId(card.cardID) }));
    if (draftcards.length === 0) {
      throw new Error('Could not create draft: no cards');
    }
    const bots = draftutil.getDraftBots(params);
    const format = draftutil.getDraftFormat(params, cube);
    const draft = new Draft();
    draftutil.populateDraft(draft, format, draftcards, bots, params.seats);
    draft.cube = cube._id;
    await draft.save();
    return res.redirect(`/cube/draft/${draft._id}`);
  } catch (err) {
    return util.handleRouteError(res, req, err, `/cube/playtest/${req.params.id}`);
  }
});

router.get('/draft/:id', async (req, res) => {
  try {
    const draft = await Draft.findById(req.params.id);
    if (!draft) {
      req.flash('danger', 'Draft not found');
      return res.status(404).render('misc/404', {});
    }

    const names = new Set();
    // add in details to all cards
    for (const seat of draft.packs) {
      for (const pack of seat) {
        for (const card of pack) {
          card.details = carddb.cardFromId(card.cardID, 'cmc type image_normal name color_identity');
          names.add(card.details.name);
        }
      }
    }

    const ratingsQ = CardRating.find({
      name: { $in: [...names] },
    });
    const cubeQ = Cube.findOne(build_id_query(draft.cube));
    const [cube, ratings] = await Promise.all([cubeQ, ratingsQ]);

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    draft.ratings = util.fromEntries(ratings.map((r) => [r.name, r.elo]));

    const reactProps = {
      cube,
      cubeID: get_cube_id(cube),
      initialDraft: draft,
    };

    return res.render('cube/cube_draft', {
      reactHTML: CubeDraftPage
        ? await ReactDOMServer.renderToString(React.createElement(CubeDraftPage, reactProps))
        : undefined,
      reactProps: serialize(reactProps),
      title: `${abbreviate(cube.name)} - Draft`,
      metadata: generateMeta(
        `Cube Cobra Draft: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/cube/draft/${req.params.id}`,
      ),
      loginCallback: `/cube/draft/${req.params.id}`,
    });
  } catch (err) {
    return util.handleRouteError(res, req, err, '/404');
  }
});

// Edit Submit POST Route
router.post('/edit/:id', ensureAuth, async (req, res) => {
  try {
    req.body.blog = sanitize(req.body.blog);
    let cube = await Cube.findOne(build_id_query(req.params.id));

    cube.date_updated = Date.now();
    cube.updated_string = cube.date_updated.toLocaleString('en-US');

    const edits = req.body.body.split(';');
    const removes = new Set();
    const adds = [];
    let changelog = '';

    for (const edit of edits) {
      if (edit.charAt(0) === '+') {
        // add id
        const details = carddb.cardFromId(edit.substring(1));
        if (!details) {
          console.error(`Card not found: ${edit}`, req);
        } else {
          adds.push(details);
          changelog += addCardHtml(details);
        }
      } else if (edit.charAt(0) === '-') {
        // remove id
        const [indexOutStr, outID] = edit.substring(1).split('$');
        const indexOut = parseInt(indexOutStr, 10);
        if (!Number.isInteger(indexOut) || indexOut < 0 || indexOut >= cube.cards.length) {
          req.flash('danger', 'Bad request format.');
          return res.redirect(`/cube/list/${req.params.id}`);
        }
        removes.add(indexOut);
        const card = cube.cards[indexOut];
        if (card.cardID === outID) {
          changelog += removeCardHtml(carddb.cardFromId(card.cardID));
        } else {
          req.flash('danger', 'Bad request format.');
          return res.redirect(`/cube/list/${req.params.id}`);
        }
      } else if (edit.charAt(0) === '/') {
        const [outStr, idIn] = edit.substring(1).split('>');
        const detailsIn = carddb.cardFromId(idIn);
        if (!detailsIn) {
          console.error(`Card not found: ${edit}`, req);
        } else {
          adds.push(detailsIn);
        }

        const [indexOutStr, outID] = outStr.split('$');
        const indexOut = parseInt(indexOutStr, 10);
        if (!Number.isInteger(indexOut) || indexOut < 0 || indexOut >= cube.cards.length) {
          req.flash('danger', 'Bad request format.');
          return res.redirect(`/cube/list/${req.params.id}`);
        }
        removes.add(indexOut);
        const cardOut = cube.cards[indexOut];
        if (cardOut.cardID === outID) {
          changelog += replaceCardHtml(carddb.cardFromId(cardOut.cardID), detailsIn);
        } else {
          req.flash('danger', 'Bad request format.');
          return res.redirect(`/cube/list/${req.params.id}`);
        }
      } else {
        req.flash('danger', 'Bad request format.');
        return res.redirect(`/cube/list/${req.params.id}`);
      }
    }

    cube.cards = cube.cards.filter((card, index) => !removes.has(index));
    for (const add of adds) {
      util.addCardToCube(cube, add);
      const maybeIndex = cube.maybe.findIndex((card) => card.cardID === add._id);
      if (maybeIndex !== -1) {
        cube.maybe.splice(maybeIndex, 1);
      }
    }

    const blogpost = new Blog();
    blogpost.title = req.body.title;
    if (req.body.blog.length > 0) {
      blogpost.html = req.body.blog;
    }
    blogpost.changelist = changelog;
    blogpost.owner = cube.owner;
    blogpost.date = Date.now();
    blogpost.cube = cube._id;
    blogpost.dev = 'false';
    blogpost.date_formatted = blogpost.date.toLocaleString('en-US');
    blogpost.username = cube.owner_name;
    blogpost.cubename = cube.name;

    cube = setCubeType(cube, carddb);

    await blogpost.save();
    await cube.save();

    req.flash('success', 'Cube Updated');
    return res.redirect(`/cube/list/${req.params.id}?updated=true`);
  } catch (err) {
    return util.handleRouteError(res, req, err, `/cube/list/${req.params.id}`);
  }
});

// API routes
router.get('/api/cardnames', (req, res) => {
  return res.status(200).send({
    success: 'true',
    cardnames: carddb.cardtree,
  });
});

// Get the full card images including image_normal and image_flip
router.get('/api/cardimages', (req, res) => {
  return res.status(200).send({
    success: 'true',
    cardimages: carddb.cardimages,
  });
});

router.get('/blogpost/:id', async (req, res) => {
  try {
    const post = await Blog.findById(req.params.id);
    const owner = await User.findById(post.owner);

    return res.render('cube/blogpost', {
      post,
      owner: owner._id,
      loginCallback: `/blogpost/${req.params.id}`,
    });
  } catch (err) {
    return util.handleRouteError(res, req, err, '/404');
  }
});

router.get('/viewcomment/:id/:position', async (req, res) => {
  try {
    const { position, id } = req.params;

    const post = await Blog.findById(req.params.id);
    const owner = await User.findById(post.owner);

    return res.render('cube/blogpost', {
      post,
      owner: owner._id,
      loginCallback: `/blogpost/${id}`,
      position: position.split('-'),
    });
  } catch (err) {
    return util.handleRouteError(res, req, err, '/404');
  }
});

router.post(
  '/api/editcomment',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const post = await Blog.findById(req.body.id);
    const { user } = req;

    if (!user) {
      return res.status(403).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    if (!post) {
      return res.status(404).send({
        success: 'false',
        message: 'Post not found',
      });
    }

    req.body.comment.content = sanitize(req.body.comment.content);
    saveEdit(post.comments, req.body.position.slice(0, 22), req.body.comment);
    await post.save();
    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.post(
  '/api/editoverview',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const updatedCube = req.body;

    const cube = await Cube.findById(updatedCube._id);
    if (!cube) {
      return res.status(404).send({
        success: 'false',
        message: 'Cube Not Found',
      });
    }

    const { user } = req;
    if (!user || user._id !== cube.owner) {
      return res.status(403).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    if (updatedCube.name.length < 5 || updatedCube.name.length > 100) {
      res.statusMessage = 'Cube name should be at least 5 characters long, and shorter than 100 characters.';
      return res.status(400).send({
        success: 'false',
      });
    }

    if (util.has_profanity(updatedCube.name)) {
      res.statusMessage = 'Cube name should not use profanity.';
      return res.status(400).send({
        success: 'false',
      });
    }

    if (updatedCube.urlAlias && updatedCube.urlAlias.length > 0 && updatedCube.urlAlias !== cube.urlAlias) {
      updatedCube.urlAlias = updatedCube.urlAlias.toLowerCase();
      const urlAliasMaxLength = 100;

      if (!updatedCube.urlAlias.match(/^[0-9a-zA-Z_]*$/)) {
        res.statusMessage = 'Custom URL must contain only alphanumeric characters or underscores.';
        return res.status(400).send({
          success: 'false',
        });
      }

      if (updatedCube.urlAlias.length > urlAliasMaxLength) {
        res.statusMessage = `Custom URL may not be longer than ${urlAliasMaxLength} characters.`;
        return res.status(400).send({
          success: 'false',
        });
      }

      if (util.has_profanity(updatedCube.urlAlias)) {
        res.statusMessage = 'Custom URL may not contain profanity.';
        return res.status(400).send({
          success: 'false',
        });
      }

      const taken = await Cube.findOne(build_id_query(updatedCube.urlAlias));

      if (taken) {
        res.statusMessage = 'Custom URL already taken.';
        return res.status(400).send({
          success: 'false',
        });
      }

      cube.urlAlias = updatedCube.urlAlias;
    } else if (!updatedCube.urlAlias || updatedCube.urlAlias === '') {
      cube.urlAlias = null;
    }

    cube.name = updatedCube.name;
    cube.isListed = updatedCube.isListed;
    cube.privatePrices = updatedCube.privatePrices;
    cube.overrideCategory = updatedCube.overrideCategory;

    const image = carddb.imagedict[updatedCube.image_name.toLowerCase()];

    if (image) {
      cube.image_uri = updatedCube.image_uri;
      cube.image_artist = updatedCube.image_artist;
      cube.image_name = updatedCube.image_name;
    }

    cube.descriptionhtml = sanitize(updatedCube.descriptionhtml);
    cube.date_updated = Date.now();
    cube.updated_string = cube.date_updated.toLocaleString('en-US');
    setCubeType(cube, carddb);

    // cube category override
    if (cube.overrideCategory) {
      const categories = ['Vintage', 'Legacy+', 'Legacy', 'Modern', 'Pioneer', 'Standard', 'Set'];
      const prefixes = ['Powered', 'Unpowered', 'Pauper', 'Peasant', 'Budget', 'Silver-bordered'];

      if (!categories.includes(updatedCube.categoryOverride)) {
        res.statusMessage = 'Not a valid category override.';
        return res.status(400).send({
          success: 'false',
        });
      }

      for (let i = 0; i < updatedCube.categoryPrefixes.length; i++) {
        if (!prefixes.includes(updatedCube.categoryPrefixes[i])) {
          res.statusMessage = 'Not a valid category prefix.';
          return res.status(400).send({
            success: 'false',
          });
        }
      }

      cube.categoryOverride = updatedCube.categoryOverride;
      cube.categoryPrefixes = updatedCube.categoryPrefixes;
    }

    // cube tags
    cube.tags = updatedCube.tags.map((tag) => tag.text);

    await cube.save();
    return res.status(200).send({ success: 'true' });
  }),
);

router.post(
  '/api/postdeckcomment',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const deck = await Deck.findById(req.body.id);
    const { user } = req;

    if (!user) {
      return res.status(403).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    if (!deck) {
      return res.status(404).send({
        success: 'false',
        message: 'Deck not found',
      });
    }

    // slice limits the recursive depth
    const comment = insertComment(deck.comments, req.body.position.slice(0, 22), {
      owner: user._id,
      ownerName: user.username,
      ownerImage: '',
      content: sanitize(req.body.content),
      // the -1000 is to prevent weird time display error
      timePosted: Date.now() - 1000,
      comments: [],
    });

    // give notification to owner
    if (req.body.position.length === 0) {
      // owner is blog deck owner
      const owner = await User.findById(deck.owner);
      await util.addNotification(
        owner,
        user,
        `/cube/deck/${deck._id}`,
        `${user.username} added a comment to ${deck.name}`,
      );
    } else {
      // need to find owner from comment tree
      const owner = await User.findById(getOwnerFromComment(deck.comments, req.body.position));
      await util.addNotification(
        owner,
        user,
        `/cube/deck/${deck._id}`,
        `${user.username} replied to your comment on ${deck.name}`,
      );
    }

    await deck.save();
    return res.status(200).send({
      success: 'true',
      comment,
    });
  }),
);

router.post(
  '/api/postcomment',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const post = await Blog.findById(req.body.id);
    const { user } = req;

    if (!user) {
      return res.status(403).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    if (!post) {
      return res.status(404).send({
        success: 'false',
        message: 'Post not found',
      });
    }

    // slice limits the recursive depth
    const comment = insertComment(post.comments, req.body.position.slice(0, 22), {
      owner: user._id,
      ownerName: user.username,
      ownerImage: '',
      content: sanitize(req.body.content),
      // the -1000 is to prevent weird time display error
      timePosted: Date.now() - 1000,
      comments: [],
    });

    // give notification to owner
    if (req.body.position.length === 0) {
      // owner is blog post owner
      const owner = await User.findById(post.owner);
      await util.addNotification(
        owner,
        user,
        `/cube/blogpost/${post._id}`,
        `${user.username} added a comment to ${post.title}`,
      );
    } else {
      // need to find owner from comment tree
      const owner = await User.findById(getOwnerFromComment(post.comments, req.body.position));
      let positionText = '';
      for (const pos of req.body.position) {
        positionText += `${pos}-`;
      }
      positionText += comment.index;
      await util.addNotification(
        owner,
        user,
        `/cube/viewcomment/${post._id}/${positionText}`,
        `${user.username} replied to your comment on ${post.title}`,
      );
    }

    await post.save();
    return res.status(200).send({
      success: 'true',
      comment,
    });
  }),
);

router.get('/api/imagedict', (req, res) => {
  res.status(200).send({
    success: 'true',
    dict: carddb.imagedict,
  });
});

router.get('/api/fullnames', (req, res) => {
  res.status(200).send({
    success: 'true',
    cardnames: carddb.full_names,
  });
});

router.get(
  '/api/cubecardnames/:id',
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.findOne(build_id_query(req.params.id));

    const cardnames = [];
    for (const card of cube.cards) {
      util.binaryInsert(carddb.cardFromId(card.cardID).name, cardnames);
    }

    const result = util.turnToTree(cardnames);
    return res.status(200).send({
      success: 'true',
      cardnames: result,
    });
  }),
);

router.post(
  '/api/saveshowtagcolors',
  util.wrapAsyncApi(async (req, res) => {
    if (req.user) {
      req.user.hide_tag_colors = !req.body.show_tag_colors;
      await req.user.save();

      return res.status(200).send({
        success: 'true',
      });
    }

    return res.status(401).send({
      success: 'false',
    });
  }),
);

router.post(
  '/api/savetagcolors/:id',
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.findOne(build_id_query(req.params.id));

    if (req.user.id !== cube.owner) {
      return res.status(401).send({
        success: 'false',
      });
    }

    cube.tag_colors = req.body;

    await cube.save();
    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.get(
  '/api/cubetagcolors/:id',
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.findOne(build_id_query(req.params.id));

    const tagColors = build_tag_colors(cube);
    const tags = tagColors.map((item) => item.tag);

    // this is for the case of cube compare
    const cubeB = await Cube.findOne(build_id_query(req.query.b_id));

    if (cubeB) {
      const bTagColors = build_tag_colors(cubeB);
      for (const bTag of bTagColors) {
        if (!tags.includes(bTag.tag)) {
          tagColors.push(bTag);
        }
      }
    }

    const showTagColors = req.user ? !req.user.hide_tag_colors : true;

    res.status(200).send({
      success: 'true',
      tagColors,
      showTagColors,
    });
  }),
);

router.get(
  '/api/getcardfromcube/:id',
  util.wrapAsyncApi(async (req, res) => {
    const split = req.params.id.split(';');
    const cubeid = split[0];
    let cardname = split[1];
    cardname = cardutil.decodeName(cardname);
    cardname = cardutil.normalizeName(cardname);

    const cube = await Cube.findOne(build_id_query(cubeid));

    for (const card of cube.cards) {
      if (carddb.cardFromId(card.cardID).name_lower === cardname) {
        card.details = carddb.cardFromId(card.cardID);
        return res.status(200).send({
          success: 'true',
          card: card.details,
        });
      }
    }
    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.get(
  '/api/cubelist/:id',
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.findOne(build_id_query(req.params.id));

    const names = cube.cards.map((card) => carddb.cardFromId(card.cardID).name);
    res.contentType('text/plain');
    return res.status(200).send(names.join('\n'));
  }),
);

router.post('/editdeck/:id', ensureAuth, async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id);

    if (deck.owner && deck.owner !== req.user.id) {
      req.flash('danger', 'Unauthorized');
      return res.status(404).render('misc/404', {});
    }

    const newdeck = JSON.parse(req.body.draftraw);
    const name = JSON.parse(req.body.name);
    const description = sanitize(JSON.parse(req.body.description));

    deck.cards = newdeck.cards;
    deck.playerdeck = newdeck.playerdeck;
    deck.playersideboard = newdeck.playersideboard;
    deck.cols = newdeck.cols;
    deck.name = name;
    deck.description = description;

    await deck.save();

    req.flash('success', 'Deck saved succesfully');
    return res.redirect(`/cube/deck/${deck._id}`);
  } catch (err) {
    return util.handleRouteError(res, req, err, '/404');
  }
});

router.post('/submitdeck/:id', async (req, res) => {
  try {
    // req.body contains draft0
    const draftid = req.body.body;
    const draft = await Draft.findById(draftid);

    const deck = new Deck();
    const [userPicks, ...botPicks] = draft.picks;
    deck.playerdeck = userPicks;
    deck.cards = botPicks;
    if (req.user) {
      deck.owner = req.user._id;
    }
    deck.cube = draft.cube;
    deck.date = Date.now();
    deck.bots = draft.bots;
    deck.playersideboard = [];
    deck.pickOrder = draft.pickOrder;
    deck.draft = draft._id;

    const cube = await Cube.findOne(build_id_query(draft.cube));

    if (!cube.decks) {
      cube.decks = [];
    }

    cube.decks.push(deck._id);
    if (!cube.numDecks) {
      cube.numDecks = 0;
    }

    cube.numDecks += 1;
    const userq = User.findById(deck.owner);
    const cubeOwnerq = User.findById(cube.owner);

    const [user, cubeOwner] = await Promise.all([userq, cubeOwnerq]);

    const owner = user ? user.username : 'Anonymous';
    deck.name = `Draft of ${cube.name}`;
    deck.username = owner;
    deck.cubename = cube.name;
    cube.decks.push(deck._id);

    if (user) {
      await util.addNotification(
        cubeOwner,
        user,
        `/cube/deck/${deck._id}`,
        `${user.username} drafted your cube: ${cube.name}`,
      );
    }

    await Promise.all([cube.save(), deck.save(), cubeOwner.save()]);

    return res.redirect(`/cube/deckbuilder/${deck._id}`);
  } catch (err) {
    return util.handleRouteError(res, req, err, `/cube/playtest/${req.params.id}`);
  }
});

router.get('/decks/:cubeid/:page', async (req, res) => {
  try {
    const { cubeid } = req.params;
    const { page } = req.params;
    const pagesize = 30;

    const cube = await Cube.findOne(build_id_query(cubeid));

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    const decksq = Deck.find({
      cube: cube._id,
    })
      .sort({
        date: -1,
      })
      .skip(pagesize * page)
      .limit(pagesize)
      .exec();
    const numDecksq = Deck.countDocuments({
      cube: cube._id,
    }).exec();
    const ownerq = User.findById(cube.owner).exec();

    const [decks, numDecks, owner] = await Promise.all([decksq, numDecksq, ownerq]);

    const ownerName = owner ? owner.username : 'unknown';

    const pages = [];
    for (let i = 0; i < numDecks / pagesize; i++) {
      if (page === i) {
        pages.push({
          url: `/cube/decks/${cubeid}/${i}`,
          content: i + 1,
          active: true,
        });
      } else {
        pages.push({
          url: `/cube/decks/${cubeid}/${i}`,
          content: i + 1,
        });
      }
    }

    return res.render('cube/cube_decks', {
      cube,
      cube_id: cubeid,
      owner: ownerName,
      activeLink: 'playtest',
      title: `${abbreviate(cube.name)} - Draft Decks`,
      decks,
      pages,
      metadata: generateMeta(
        `Cube Cobra Decks: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/user/decks/${req.params.cubeid}`,
      ),
      loginCallback: `/user/decks/${cubeid}`,
    });
  } catch (err) {
    return util.handleRouteError(res, req, err, `/cube/playtest/${req.params.cubeid}`);
  }
});

router.get('/decks/:id', async (req, res) => {
  res.redirect(`/cube/decks/${req.params.id}/0`);
});

router.get('/rebuild/:id', ensureAuth, async (req, res) => {
  try {
    const base = await Deck.findById(req.params.id);
    if (!base) {
      req.flash('danger', 'Deck not found');
      return res.status(404).render('misc/404', {});
    }

    const deck = new Deck();
    deck.playerdeck = base.playerdeck;
    deck.cards = base.cards;
    deck.owner = req.user._id;
    deck.cube = base.cube;
    deck.date = Date.now();
    deck.bots = base.bots;
    deck.playersideboard = base.playersideboard;

    const cube = await Cube.findOne(build_id_query(deck.cube));

    if (!cube.decks) {
      cube.decks = [];
    }

    cube.decks.push(deck._id);
    if (!cube.numDecks) {
      cube.numDecks = 0;
    }

    cube.numDecks += 1;
    const userq = User.findById(deck.owner);
    const baseuserq = User.findById(base.owner);
    const cubeOwnerq = User.findById(cube.owner);

    const [user, cubeOwner, baseUser] = await Promise.all([userq, cubeOwnerq, baseuserq]);

    const owner = user ? user.username : 'Anonymous';
    deck.name = `${owner}'s rebuild from ${cube.name} on ${deck.date.toLocaleString('en-US')}`;
    deck.username = owner;
    deck.cubename = cube.name;
    cube.decks.push(deck._id);

    if (cubeOwner._id !== user.id) {
      await util.addNotification(
        cubeOwner,
        user,
        `/cube/deck/${deck._id}`,
        `${user.username} rebuilt a deck from your cube: ${cube.name}`,
      );
    }
    if (baseUser && baseUser._id !== user.id) {
      await util.addNotification(
        baseUser,
        user,
        `/cube/deck/${deck._id}`,
        `${user.username} rebuilt your deck from cube: ${cube.name}`,
      );
    }

    await Promise.all([cube.save(), deck.save()]);

    return res.redirect(`/cube/deckbuilder/${deck._id}`);
  } catch (err) {
    return util.handleRouteError(res, req, err, `/cube/playtest/${req.params.id}`);
  }
});

router.get('/redraft/:id', async (req, res) => {
  try {
    const base = await Deck.findById(req.params.id);

    if (!base) {
      req.flash('danger', 'Deck not found');
      return res.status(404).render('misc/404', {});
    }

    const srcDraft = await Draft.findById(base.draft);

    if (!srcDraft) {
      req.flash('danger', 'This deck is not able to be redrafted.');
      res.redirect(`/cube/deck/${req.params.id}`);
    }

    const draft = new Draft();
    draft.bots = base.bots.slice();
    draft.cube = base.cube.slice();
    draft.packNumber = 1;
    draft.pickNumber = 1;

    draft.initial_state = srcDraft.initial_state.slice();
    draft.packs = srcDraft.initial_state.slice();
    draft.picks = [];

    for (let i = 0; i < draft.packs.length; i++) {
      draft.picks.push([]);
    }

    await draft.save();
    return res.redirect(`/cube/draft/${draft._id}`);
  } catch (err) {
    return util.handleRouteError(res, req, err, `/cube/playtest/${req.params.id}`);
  }
});

router.get('/deckbuilder/:id', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id);
    if (!deck) {
      req.flash('danger', 'Deck not found');
      return res.status(404).render('misc/404', {});
    }

    const deckOwner = await User.findById(deck.owner);

    if (!req.user || deckOwner._id !== req.user.id) {
      req.flash('danger', 'Only logged in deck owners can build decks.');
      return res.redirect(`/cube/deck/${req.params.id}`);
    }

    // add images to cards
    for (const cardOrStack of deck.cards) {
      if (Array.isArray(cardOrStack)) {
        for (const card of cardOrStack) {
          card.details = carddb.cardFromId(card.cardID);
        }
      } else {
        cardOrStack.details = carddb.cardFromId(cardOrStack);
      }
    }

    const cube = await Cube.findOne(build_id_query(deck.cube), Cube.LAYOUT_FIELDS);

    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    const reactProps = {
      cube,
      cubeID: get_cube_id(cube),
      initialDeck: deck,
      basics: getBasics(carddb),
    };

    return res.render('cube/cube_deckbuilder', {
      reactProps: serialize(reactProps),
      activeLink: 'playtest',
      title: `${abbreviate(cube.name)} - Deckbuilder`,
      metadata: generateMeta(
        `Cube Cobra Draft: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/cube/draft/${req.params.id}`,
      ),
      loginCallback: `/cube/draft/${req.params.id}`,
    });
  } catch (err) {
    return util.handleRouteError(res, req, err, '/404');
  }
});

router.get('/deck/:id', async (req, res) => {
  try {
    const deck = await Deck.findById(req.params.id);

    if (!deck) {
      req.flash('danger', 'Deck not found');
      return res.status(404).render('misc/404', {});
    }

    const cube = await Cube.findOne(build_id_query(deck.cube), Cube.LAYOUT_FIELDS);
    if (!cube) {
      req.flash('danger', 'Cube not found');
      return res.status(404).render('misc/404', {});
    }

    const owner = {
      name: 'Unknown',
      id: null,
      profileUrl: null,
    };

    const drafter = {
      name: 'Anonymous',
      id: null,
      profileUrl: null,
    };

    const deckUserq = User.findById(deck.owner);
    const cubeUserq = User.findById(cube.owner);

    const [deckUser, cubeUser] = await Promise.all([deckUserq, cubeUserq]);

    if (deckUser) {
      drafter.name = deckUser.username;
      drafter.id = deckUser._id;
      drafter.profileUrl = `/user/view/${deckUser._id}`;
    }

    if (cubeUser) {
      owner.name = cubeUser.username;
      owner.id = cubeUser._id;
      owner.profileUrl = `/user/view/${cubeUser._id}`;
    }

    const playerDeck = [];
    const botDecks = [];
    if (deck.newformat === false && typeof deck.cards[deck.cards.length - 1][0] === 'object') {
      // old format
      for (const card of deck.cards[0]) {
        card.details = carddb.cardFromId(card);
        playerDeck.push(card.details);
      }
      for (let i = 1; i < deck.cards.length; i++) {
        const botDeck = [];
        for (const card of deck.cards[i]) {
          if (!card[0].cardID && !carddb.cardFromId(card[0].cardID).error) {
            console.error(`${req.params.id}: Could not find seat ${botDecks.length + 1}, pick ${botDeck.length + 1}`);
          } else {
            const details = carddb.cardFromId(card[0].cardID);
            botDeck.push(details);
          }
        }
        botDecks.push(botDeck);
      }
      const botNames = [];
      for (let i = 0; i < deck.bots.length; i++) {
        botNames.push(`Seat ${i + 2}: ${deck.bots[i][0]}, ${deck.bots[i][1]}`);
      }

      const reactProps = {
        cube,
        cubeID: get_cube_id(cube),
        oldFormat: true,
        drafter,
        cards: playerDeck,
        description: deck.description,
        name: deck.name,
        sideboard: deck.sideboard,
        botDecks,
        bots: botNames,
        canEdit: req.user ? req.user.id === owner.id : false,
        comments: deck.comments,
        deckid: deck._id,
        userid: req.user ? req.user.id : null,
      };

      return res.render('cube/cube_deck', {
        reactProps: serialize(reactProps),
        title: `${abbreviate(cube.name)} - ${drafter.name}'s deck`,
        metadata: generateMeta(
          `Cube Cobra Deck: ${cube.name}`,
          cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
          cube.image_uri,
          `https://cubecobra.com/cube/deck/${req.params.id}`,
        ),
        loginCallback: `/cube/deck/${req.params.id}`,
      });
    }
    // new format
    for (let i = 0; i < deck.cards.length; i++) {
      const botDeck = [];
      for (const cardID of deck.cards[i]) {
        if (carddb.cardFromId(cardID).error) {
          console.error(`${req.params.id}: Could not find seat ${botDecks.length + 1}, pick ${botDeck.length + 1}`);
        } else {
          const details = carddb.cardFromId(cardID);
          botDeck.push(details);
        }
      }
      botDecks.push(botDeck);
    }
    const botNames = [];
    for (let i = 0; i < deck.bots.length; i++) {
      botNames.push(`Seat ${i + 2}: ${deck.bots[i][0]}, ${deck.bots[i][1]}`);
    }

    const reactProps = {
      cube,
      cubeID: get_cube_id(cube),
      oldFormat: false,
      drafter,
      deck: deck.playerdeck,
      sideboard: deck.playersideboard,
      description: deck.description,
      name: deck.name,
      botDecks,
      bots: botNames,
      canEdit: req.user ? req.user.id === owner.id : false,
      comments: deck.comments,
      deckid: deck._id,
      userid: req.user ? req.user.id : null,
    };

    return res.render('cube/cube_deck', {
      reactProps: serialize(reactProps),
      title: `${abbreviate(cube.name)} - ${drafter.name}'s deck`,
      metadata: generateMeta(
        `Cube Cobra Deck: ${cube.name}`,
        cube.type ? `${cube.card_count} Card ${cube.type} Cube` : `${cube.card_count} Card Cube`,
        cube.image_uri,
        `https://cubecobra.com/cube/deck/${req.params.id}`,
      ),
      loginCallback: `/cube/deck/${req.params.id}`,
    });
  } catch (err) {
    return util.handleRouteError(res, req, err, '/404');
  }
});

router.get('/api/getcard/:name', (req, res) => {
  const potentialIds = carddb.getIdsFromName(cardutil.decodeName(req.params.name));
  if (potentialIds && potentialIds.length > 0) {
    const nonPromo = potentialIds.find(carddb.notPromoOrDigitalId);
    const selected = nonPromo || potentialIds[0];
    const card = carddb.cardFromId(selected);
    return res.status(200).send({
      success: 'true',
      card,
    });
  }
  return res.status(200).send({
    success: 'false',
  });
});

router.get(
  '/api/getimage/:name',
  util.wrapAsyncApi(async (req, res) => {
    const reasonable = carddb.getMostReasonable(cardutil.decodeName(req.params.name));
    const img = carddb.imagedict[reasonable.name];
    if (!img) {
      return res.status(200).send({
        success: 'false',
      });
    }
    return res.status(200).send({
      success: 'true',
      img,
    });
  }),
);

router.get(
  '/api/getcardfromid/:id',
  util.wrapAsyncApi(async (req, res) => {
    const card = carddb.cardFromId(req.params.id);
    // need to get the price of the card with the new version in here
    const tcg = [];
    if (card.tcgplayer_id) {
      tcg.push(card.tcgplayer_id);
    }
    const priceDict = await GetPrices(tcg);
    if (card.error) {
      return res.status(200).send({
        success: 'false',
      });
    }
    if (priceDict[card.tcgplayer_id]) {
      card.price = priceDict[card.tcgplayer_id];
    }
    if (priceDict[`${card.tcgplayer_id}_foil`]) {
      card.price_foil = priceDict[`${card.tcgplayer_id}_foil`];
    }
    return res.status(200).send({
      success: 'true',
      card,
    });
  }),
);

router.get(
  '/api/getversions/:id',
  util.wrapAsyncApi(async (req, res) => {
    const cards = [];
    const tcg = [];
    const names = [];
    for (const id of carddb.allIds(carddb.cardFromId(req.params.id))) {
      const card = carddb.cardFromId(id);
      cards.push(card);
      if (card.tcgplayer_id) {
        tcg.push(card.tcgplayer_id);
      }
      names.push(card.name);
    }
    const priceDict = await GetPrices(tcg);
    const eloDict = await getElo(names, true);
    for (const card of cards) {
      if (card.tcgplayer_id) {
        const cardPriceData = priceDict[card.tcgplayer_id];
        if (cardPriceData) {
          card.price = cardPriceData;
        }
        const cardFoilPriceData = priceDict[`${card.tcgplayer_id}_foil`];
        if (cardFoilPriceData) {
          card.price_foil = cardFoilPriceData;
        }
      }
      if (eloDict[card.name]) {
        card.elo = eloDict[card.name];
      }
    }
    return res.status(200).send({
      success: 'true',
      cards,
    });
  }),
);

router.post(
  '/api/getversions',
  util.wrapAsyncApi(async (req, res) => {
    const cards = {};

    for (const cardid of req.body) {
      cards[cardid] = [];
      carddb.nameToId[
        carddb
          .cardFromId(cardid)
          .name.toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
      ].forEach((id) => {
        const card = carddb.cardFromId(id);
        cards[cardid].push({
          id,
          version: card.full_name
            .toUpperCase()
            .substring(carddb.cardFromId(id).full_name.indexOf('[') + 1, card.full_name.indexOf(']')),
          img: card.image_normal,
        });
      });
    }
    return res.status(200).send({
      success: 'true',
      dict: cards,
    });
  }),
);

router.post(
  '/api/updatecard/:id',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const { src, updated } = req.body;
    if (
      !src ||
      (src && typeof src.index !== 'number') ||
      (updated.cardID && typeof updated.cardID !== 'string') ||
      (updated.cmc && !['number', 'string'].includes(typeof updated.cmc)) ||
      (updated.status && typeof updated.status !== 'string') ||
      (updated.type_line && typeof updated.type_line !== 'string') ||
      (updated.colors && !Array.isArray(updated.colors)) ||
      (updated.tags && !Array.isArray(updated.tags)) ||
      (updated.finish && typeof updated.finish !== 'string')
    ) {
      return res.status(400).send({
        success: 'false',
        message: 'Failed input validation',
      });
    }
    const cube = await Cube.findOne(build_id_query(req.params.id));

    if (cube.owner !== String(req.user.id)) {
      return res.status(401).send({
        success: 'false',
        message: 'Insufficient permissions',
      });
    }
    if (src.index >= cube.cards.length) {
      return res.status(400).send({
        success: 'false',
        message: 'No such card',
      });
    }

    const card = cube.cards[src.index];
    if (!card.type_line) {
      card.type_line = carddb.cardFromId(card.cardID).type;
    }

    if (!cardsAreEquivalent(src, card)) {
      return res.status(400).send({
        success: 'false',
        message: 'Cards not equivalent',
      });
    }

    for (const key of Object.keys(Cube.schema.paths.cards.schema.paths)) {
      if (!Object.prototype.hasOwnProperty.call(updated, key)) {
        updated[key] = card[key];
      }
    }
    for (const key of Object.keys(updated)) {
      if (updated[key] === null) {
        delete updated[key];
      }
    }
    cube.cards[src.index] = updated;

    setCubeType(cube, carddb);

    await cube.save();
    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.post(
  '/api/updatecards/:id',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const { selected, updated } = req.body;
    if (
      (updated.cmc && typeof updated.cmc !== 'number') ||
      (updated.status && typeof updated.status !== 'string') ||
      (updated.type_line && typeof updated.type_line !== 'string') ||
      (updated.colors && !Array.isArray(updated.colors)) ||
      (updated.tags && !Array.isArray(updated.tags)) ||
      !Array.isArray(selected) ||
      selected.some((index) => !Number.isInteger(index) || index < 0)
    ) {
      return res.status(400).send({
        success: 'false',
        message: 'Failed input validation',
      });
    }

    const cube = await Cube.findOne(build_id_query(req.params.id));
    if (cube.owner !== req.user.id) {
      return res.status(404).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    const allUpdates = {
      $set: {},
    };
    for (const index of selected) {
      if (updated.status) {
        allUpdates.$set[`cards.${index}.status`] = updated.status;
      }
      if (updated.cmc) {
        allUpdates.$set[`cards.${index}.cmc`] = updated.cmc;
      }
      if (updated.type_line) {
        allUpdates.$set[`cards.${index}.type_line`] = updated.type_line;
      }
      if (updated.colors) {
        allUpdates.$set[`cards.${index}.colors`] = updated.colors.filter((color) => [...'WUBRG'].includes(color));
      }
      if (updated.colorC) {
        allUpdates.$set[`cards.${index}.colors`] = [];
      }
      if (updated.finish) {
        allUpdates.$set[`cards.${index}.finish`] = updated.finish;
      }
      if (updated.tags) {
        if (updated.addTags) {
          if (!allUpdates.$addToSet) {
            allUpdates.$addToSet = {};
          }
          allUpdates.$addToSet[`cards.${index}.tags`] = updated.tags;
        }
        if (updated.deleteTags) {
          if (!allUpdates.$pullAll) {
            allUpdates.$pullAll = {};
          }
          allUpdates.$pullAll[`cards.${index}.tags`] = updated.tags;
        }
      }
    }

    await cube.updateOne(allUpdates);
    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.get(
  '/api/maybe/:id',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.findOne(build_id_query(req.params.id));
    return res.status(200).send({
      success: 'true',
      maybe: maybeCards(cube, carddb),
    });
  }),
);

router.post(
  '/api/maybe/:id',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.findOne(build_id_query(req.params.id));
    if (req.user.id !== cube.owner) {
      return res.status(403).send({
        success: 'false',
        message: 'Maybeboard can only be updated by cube owner.',
      });
    }

    const maybe = [...(cube.maybe || [])];

    const removeIndices = Array.isArray(req.body.remove) ? req.body.remove : [];
    const withRemoved = maybe.filter((card, index) => !removeIndices.includes(index));

    const addCards = Array.isArray(req.body.add) ? req.body.add : [];
    const addCardsNoDetails = addCards.map(({ details, ...card }) => ({ ...util.newCard(details), ...card }));
    const withAdded = [...withRemoved, ...addCardsNoDetails];

    cube.maybe = withAdded;
    await cube.save();

    const added = cube.maybe.slice(cube.maybe.length - addCardsNoDetails.length);

    return res.status(200).send({
      success: 'true',
      added: util.fromEntries(added.map(({ _id, cardID }) => [cardID, _id])),
    });
  }),
);

router.post(
  '/api/maybe/update/:id',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.findOne(build_id_query(req.params.id));
    if (req.user.id !== cube.owner) {
      return res.status(403).send({
        success: 'false',
        message: 'Maybeboard can only be updated by cube owner.',
      });
    }

    const card = cube.maybe.find((c) => c._id.equals(req.body.id));
    if (!card) {
      return res.status(404).send({
        success: 'false',
        message: 'No card found to update.',
      });
    }

    const { updated } = req.body;
    if (!updated) {
      return res.status(400).send({
        success: 'false',
        message: 'Bad request.',
      });
    }
    const newVersion = updated.cardID && updated.cardID !== card.cardID;
    for (const field of ['cardID', 'status', 'finish', 'cmc', 'type_line', 'imgUrl', 'colors']) {
      if (Object.prototype.hasOwnProperty.call(updated, field)) {
        card[field] = updated[field];
      }
    }
    await cube.save();

    if (newVersion) {
      return res.status(200).send({
        success: 'true',
        details: carddb.cardFromId(card.cardID),
      });
    }

    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.post('/remove/:id', ensureAuth, async (req, res) => {
  try {
    const cube = await Cube.findOne(build_id_query(req.params.id));

    if (req.user.id !== cube.owner) {
      req.flash('danger', 'Not Authorized');
      res.redirect(`/cube/overview/${req.params.id}`);
    }
    await Cube.deleteOne(build_id_query(req.params.id));

    req.flash('success', 'Cube Removed');
    return res.redirect('/dashboard');
  } catch (err) {
    return util.handleRouteError(res, req, err, '/404');
  }
});

router.delete('/blog/remove/:id', ensureAuth, async (req, res) => {
  try {
    const query = {
      _id: req.params.id,
    };

    const blog = await Blog.findById(req.params.id);

    if (blog.owner !== req.user.id) {
      req.flash('danger', 'Unauthorized');
      return res.status(404).render('misc/404', {});
    }
    await Blog.deleteOne(query);

    req.flash('success', 'Post Removed');
    return res.send('Success');
  } catch (err) {
    return res.status(500).send({
      success: 'false',
      message: 'Error deleting post.',
    });
  }
});

router.delete('/format/remove/:id', ensureAuth, async (req, res) => {
  try {
    const cubeid = req.params.id.split(';')[0];
    const id = parseInt(req.params.id.split(';')[1], 10);

    const cube = await Cube.findOne(build_id_query(cubeid));
    if (!cube || cube.owner !== req.user.id || !Number.isInteger(id) || id < 0 || id >= cube.draft_formats.length) {
      return res.sendStatus(401);
    }

    cube.draft_formats.splice(id, 1);

    await Cube.save();
    return res.status(200).send({
      success: 'true',
    });
  } catch (err) {
    return res.status(500).send({
      success: 'false',
      message: 'Error deleting format.',
    });
  }
});

router.post(
  '/api/savesorts/:id',
  ensureAuth,
  util.wrapAsyncApi(async (req, res) => {
    const cube = await Cube.findOne(build_id_query(req.params.id));

    if (cube.owner !== req.user.id) {
      return res.status(404).send({
        success: 'false',
        message: 'Unauthorized',
      });
    }

    cube.default_sorts = req.body.sorts;
    await cube.save();
    return res.status(200).send({
      success: 'true',
    });
  }),
);

const ELO_BASE = 400;
const ELO_RANGE = 1600;
const ELO_SPEED = 1000;
router.post(
  '/api/draftpickcard/:id',
  util.wrapAsyncApi(async (req, res) => {
    const draftQ = Draft.findById({ _id: req.body.draft_id });
    const ratingQ = CardRating.findOne({ name: req.body.pick }).then((rating) => rating || new CardRating());
    const packQ = CardRating.find({ name: { $in: req.body.pack } });

    const [draft, rating, packRatings] = await Promise.all([draftQ, ratingQ, packQ]);

    if (draft && draft.packs[0] && draft.packs[0][0]) {
      const cardsPerPack = draft.packs[0][0].length + draft.pickNumber - 1;
      const updatedRating = (cardsPerPack - draft.packs[0][0].length + 1) / cardsPerPack;

      if (rating.picks) {
        rating.value = rating.value * (rating.picks / (rating.picks + 1)) + updatedRating * (1 / (rating.picks + 1));
        rating.picks += 1;
      } else {
        rating.name = req.body.pick;
        rating.value = updatedRating;
        rating.elo = ELO_BASE + ELO_RANGE / 2;
        rating.picks = 1;
      }

      if (!Number.isFinite(rating.elo)) {
        rating.elo = ELO_BASE + ELO_RANGE / (1 + ELO_SPEED ** -(0.5 - rating.value));
      }
      // Update ELO.
      for (const other of packRatings) {
        if (!Number.isFinite(other.elo)) {
          if (!Number.isFinite(other.value)) {
            other.elo = ELO_BASE + ELO_RANGE / 2;
          } else {
            other.elo = ELO_BASE + ELO_RANGE / (1 + ELO_SPEED ** -(0.5 - other.value));
          }
        }

        const diff = other.elo - rating.elo;
        // Expected performance for pick.
        const expectedA = 1 / (1 + 10 ** (diff / 400));
        const expectedB = 1 - expectedA;
        const adjustmentA = 2 * (1 - expectedA);
        const adjustmentB = 2 * (0 - expectedB);
        rating.elo += adjustmentA;
        other.elo += adjustmentB;
      }

      await Promise.all([rating.save(), packRatings.map((r) => r.save())]);
    }
    return res.status(200).send({
      success: 'true',
    });
  }),
);

router.post('/api/draftpick/:id', async (req, res) => {
  await Draft.updateOne({ _id: req.body._id }, req.body);

  return res.status(200).send({
    success: 'true',
  });
});

router.get(
  '/api/p1p1/:id',
  util.wrapAsyncApi(async (req, res) => {
    const result = await generatePack(req.params.id, carddb, false);

    return res.status(200).send({
      seed: result.seed,
      pack: result.pack.map((card) => card.name),
    });
  }),
);

router.get(
  '/api/p1p1/:id/:seed',
  util.wrapAsyncApi(async (req, res) => {
    const result = await generatePack(req.params.id, carddb, req.params.seed);

    return res.status(200).send({
      seed: req.params.seed,
      pack: result.pack.map((card) => card.name),
    });
  }),
);

module.exports = router;
