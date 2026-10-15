const express = require('express');

const app = express();
const PORT = process.env.PORT || 8080;

// Parse JSON bodies
app.use(express.json());

// In-memory data storage (empty at startup)
let dishes = [];
let nextId = 1;

const VALID_CATEGORIES = new Set([
  'Starter',
  'MainCourse',
  'Dessert',
  'Beverage',
  'Snack'
]);

const ALLOWED_QUERY_PARAMS = new Set([
  'page',
  'limit',
  'search',
  'category',
  'isVegetarian',
  'minPrice',
  'maxPrice',
  'sort',
  'order'
]);

// Field validators
function validateDishName(name) {
  if (typeof name !== 'string') return null;
  const trimmed = name.trim();
  if (trimmed.length < 3 || trimmed.length > 60) return null;
  return trimmed;
}

function validateRestaurant(rest) {
  if (typeof rest !== 'string') return null;
  const trimmed = rest.trim();
  if (trimmed.length < 2 || trimmed.length > 40) return null;
  return trimmed;
}

function validateCategory(cat) {
  if (typeof cat !== 'string') return null;
  if (!VALID_CATEGORIES.has(cat)) return null;
  return cat;
}

function validatePrice(p) {
  if (typeof p !== 'number' || !Number.isFinite(p)) return null;
  if (p <= 0 || p > 5000) return null;
  return p;
}

function validateCalories(cal) {
  if (typeof cal !== 'number' || !Number.isInteger(cal)) return null;
  if (cal < 0 || cal > 5000) return null;
  return cal;
}

function validateIsVegetarian(isVeg) {
  if (typeof isVeg !== 'boolean') return null;
  return isVeg;
}

// 1. POST /api/dishes - Create a record
app.post('/api/dishes', (req, res) => {
  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  const { dishName, restaurant, category, price, calories, isVegetarian } = req.body;

  // Validate all required fields
  const cleanDishName = validateDishName(dishName);
  if (cleanDishName === null) {
    return res.status(400).json({ error: 'dishName must be a string between 3 and 60 characters after trimming' });
  }

  const cleanRestaurant = validateRestaurant(restaurant);
  if (cleanRestaurant === null) {
    return res.status(400).json({ error: 'restaurant must be a string between 2 and 40 characters after trimming' });
  }

  const cleanCategory = validateCategory(category);
  if (cleanCategory === null) {
    return res.status(400).json({ error: 'category must be one of: Starter, MainCourse, Dessert, Beverage, Snack' });
  }

  const cleanPrice = validatePrice(price);
  if (cleanPrice === null) {
    return res.status(400).json({ error: 'price must be a number greater than 0 and at most 5000' });
  }

  const cleanCalories = validateCalories(calories);
  if (cleanCalories === null) {
    return res.status(400).json({ error: 'calories must be an integer between 0 and 5000' });
  }

  const cleanIsVegetarian = validateIsVegetarian(isVegetarian);
  if (cleanIsVegetarian === null) {
    return res.status(400).json({ error: 'isVegetarian must be a boolean (true or false)' });
  }

  const newDish = {
    id: nextId++,
    dishName: cleanDishName,
    restaurant: cleanRestaurant,
    category: cleanCategory,
    price: cleanPrice,
    calories: cleanCalories,
    isVegetarian: cleanIsVegetarian
  };

  dishes.push(newDish);
  return res.status(201).json(newDish);
});

// 2. GET /api/dishes - List records (search, filter, sort, pagination)
app.get('/api/dishes', (req, res) => {
  // Validate query parameter keys
  for (const key of Object.keys(req.query)) {
    if (!ALLOWED_QUERY_PARAMS.has(key)) {
      return res.status(400).json({ error: `Unknown query parameter: ${key}` });
    }
  }

  const {
    page: rawPage,
    limit: rawLimit,
    search,
    category,
    isVegetarian,
    minPrice,
    maxPrice,
    sort,
    order
  } = req.query;

  // Validate page
  let page = 1;
  if (rawPage !== undefined) {
    if (typeof rawPage !== 'string' || !/^[1-9]\d*$/.test(rawPage)) {
      return res.status(400).json({ error: 'page must be a positive integer' });
    }
    page = parseInt(rawPage, 10);
  }

  // Validate limit
  let limit = 10;
  if (rawLimit !== undefined) {
    if (typeof rawLimit !== 'string' || !/^[1-9]\d*$/.test(rawLimit)) {
      return res.status(400).json({ error: 'limit must be a positive integer' });
    }
    limit = parseInt(rawLimit, 10);
    if (limit > 50) {
      return res.status(400).json({ error: 'limit cannot exceed 50' });
    }
  }

  // Validate category filter
  if (category !== undefined) {
    if (typeof category !== 'string' || !VALID_CATEGORIES.has(category)) {
      return res.status(400).json({ error: 'category must be one of: Starter, MainCourse, Dessert, Beverage, Snack' });
    }
  }

  // Validate isVegetarian filter
  let vegFilter = null;
  if (isVegetarian !== undefined) {
    if (isVegetarian === 'true') {
      vegFilter = true;
    } else if (isVegetarian === 'false') {
      vegFilter = false;
    } else {
      return res.status(400).json({ error: 'isVegetarian must be true or false' });
    }
  }

  // Validate minPrice filter
  let minP = null;
  if (minPrice !== undefined) {
    if (typeof minPrice !== 'string' || minPrice.trim() === '') {
      return res.status(400).json({ error: 'minPrice must be a valid non-negative number' });
    }
    const parsed = Number(minPrice);
    if (Number.isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0) {
      return res.status(400).json({ error: 'minPrice must be a valid non-negative number' });
    }
    minP = parsed;
  }

  // Validate maxPrice filter
  let maxP = null;
  if (maxPrice !== undefined) {
    if (typeof maxPrice !== 'string' || maxPrice.trim() === '') {
      return res.status(400).json({ error: 'maxPrice must be a valid non-negative number' });
    }
    const parsed = Number(maxPrice);
    if (Number.isNaN(parsed) || !Number.isFinite(parsed) || parsed < 0) {
      return res.status(400).json({ error: 'maxPrice must be a valid non-negative number' });
    }
    maxP = parsed;
  }

  // Validate search
  if (search !== undefined) {
    if (typeof search !== 'string') {
      return res.status(400).json({ error: 'search must be a string' });
    }
  }

  // Validate sort
  const VALID_SORT_FIELDS = new Set(['dishName', 'price', 'calories']);
  if (sort !== undefined) {
    if (typeof sort !== 'string' || !VALID_SORT_FIELDS.has(sort)) {
      return res.status(400).json({ error: 'sort must be one of: dishName, price, calories' });
    }
  }

  // Validate order
  let sortOrder = 'asc';
  if (order !== undefined) {
    if (order !== 'asc' && order !== 'desc') {
      return res.status(400).json({ error: 'order must be asc or desc' });
    }
    sortOrder = order;
  }

  // --- Processing Pipeline: Filters -> Search -> Sort -> Pagination ---
  let results = [...dishes];

  // 1. Filter: category
  if (category !== undefined) {
    results = results.filter(d => d.category === category);
  }

  // 2. Filter: isVegetarian
  if (vegFilter !== null) {
    results = results.filter(d => d.isVegetarian === vegFilter);
  }

  // 3. Filter: minPrice (inclusive)
  if (minP !== null) {
    results = results.filter(d => d.price >= minP);
  }

  // 4. Filter: maxPrice (inclusive)
  if (maxP !== null) {
    results = results.filter(d => d.price <= maxP);
  }

  // 5. Search: case-insensitive "contains" match on dishName or restaurant
  if (search !== undefined && search.length > 0) {
    const term = search.toLowerCase();
    results = results.filter(d =>
      d.dishName.toLowerCase().includes(term) ||
      d.restaurant.toLowerCase().includes(term)
    );
  }

  // 6. Sort
  if (sort !== undefined) {
    const multiplier = sortOrder === 'desc' ? -1 : 1;
    results.sort((a, b) => {
      if (sort === 'dishName') {
        return a.dishName.toLowerCase().localeCompare(b.dishName.toLowerCase()) * multiplier;
      }
      if (sort === 'price') {
        return (a.price - b.price) * multiplier;
      }
      if (sort === 'calories') {
        return (a.calories - b.calories) * multiplier;
      }
      return 0;
    });
  }

  // 7. Pagination
  const total = results.length;
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);
  const startIndex = (page - 1) * limit;
  const data = results.slice(startIndex, startIndex + limit);

  return res.status(200).json({
    data,
    page,
    limit,
    total,
    totalPages
  });
});

// 3. GET /api/dishes/:id - Get one record
app.get('/api/dishes/:id', (req, res) => {
  const dish = dishes.find(d => String(d.id) === req.params.id);
  if (!dish) {
    return res.status(404).json({ error: 'Record not found' });
  }
  return res.status(200).json(dish);
});

// 4. PUT /api/dishes/:id - Replace a record (all required fields)
app.put('/api/dishes/:id', (req, res) => {
  const index = dishes.findIndex(d => String(d.id) === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Record not found' });
  }

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  const { dishName, restaurant, category, price, calories, isVegetarian } = req.body;

  const cleanDishName = validateDishName(dishName);
  if (cleanDishName === null) {
    return res.status(400).json({ error: 'dishName must be a string between 3 and 60 characters after trimming' });
  }

  const cleanRestaurant = validateRestaurant(restaurant);
  if (cleanRestaurant === null) {
    return res.status(400).json({ error: 'restaurant must be a string between 2 and 40 characters after trimming' });
  }

  const cleanCategory = validateCategory(category);
  if (cleanCategory === null) {
    return res.status(400).json({ error: 'category must be one of: Starter, MainCourse, Dessert, Beverage, Snack' });
  }

  const cleanPrice = validatePrice(price);
  if (cleanPrice === null) {
    return res.status(400).json({ error: 'price must be a number greater than 0 and at most 5000' });
  }

  const cleanCalories = validateCalories(calories);
  if (cleanCalories === null) {
    return res.status(400).json({ error: 'calories must be an integer between 0 and 5000' });
  }

  const cleanIsVegetarian = validateIsVegetarian(isVegetarian);
  if (cleanIsVegetarian === null) {
    return res.status(400).json({ error: 'isVegetarian must be a boolean (true or false)' });
  }

  // Preserve original id
  const existingId = dishes[index].id;
  const updatedDish = {
    id: existingId,
    dishName: cleanDishName,
    restaurant: cleanRestaurant,
    category: cleanCategory,
    price: cleanPrice,
    calories: cleanCalories,
    isVegetarian: cleanIsVegetarian
  };

  dishes[index] = updatedDish;
  return res.status(200).json(updatedDish);
});

// 5. PATCH /api/dishes/:id - Update some fields
app.patch('/api/dishes/:id', (req, res) => {
  const index = dishes.findIndex(d => String(d.id) === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Record not found' });
  }

  if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
    return res.status(400).json({ error: 'Request body must be a JSON object' });
  }

  const modifiableFields = ['dishName', 'restaurant', 'category', 'price', 'calories', 'isVegetarian'];
  const presentFields = modifiableFields.filter(f => Object.prototype.hasOwnProperty.call(req.body, f));

  if (presentFields.length === 0) {
    return res.status(400).json({ error: 'PATCH requires at least one recognized field to update' });
  }

  const updates = {};

  if (Object.prototype.hasOwnProperty.call(req.body, 'dishName')) {
    const cleanDishName = validateDishName(req.body.dishName);
    if (cleanDishName === null) {
      return res.status(400).json({ error: 'dishName must be a string between 3 and 60 characters after trimming' });
    }
    updates.dishName = cleanDishName;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'restaurant')) {
    const cleanRestaurant = validateRestaurant(req.body.restaurant);
    if (cleanRestaurant === null) {
      return res.status(400).json({ error: 'restaurant must be a string between 2 and 40 characters after trimming' });
    }
    updates.restaurant = cleanRestaurant;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'category')) {
    const cleanCategory = validateCategory(req.body.category);
    if (cleanCategory === null) {
      return res.status(400).json({ error: 'category must be one of: Starter, MainCourse, Dessert, Beverage, Snack' });
    }
    updates.category = cleanCategory;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'price')) {
    const cleanPrice = validatePrice(req.body.price);
    if (cleanPrice === null) {
      return res.status(400).json({ error: 'price must be a number greater than 0 and at most 5000' });
    }
    updates.price = cleanPrice;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'calories')) {
    const cleanCalories = validateCalories(req.body.calories);
    if (cleanCalories === null) {
      return res.status(400).json({ error: 'calories must be an integer between 0 and 5000' });
    }
    updates.calories = cleanCalories;
  }

  if (Object.prototype.hasOwnProperty.call(req.body, 'isVegetarian')) {
    const cleanIsVegetarian = validateIsVegetarian(req.body.isVegetarian);
    if (cleanIsVegetarian === null) {
      return res.status(400).json({ error: 'isVegetarian must be a boolean (true or false)' });
    }
    updates.isVegetarian = cleanIsVegetarian;
  }

  // Apply updates, preserving id
  dishes[index] = {
    ...dishes[index],
    ...updates,
    id: dishes[index].id
  };

  return res.status(200).json(dishes[index]);
});

// 6. DELETE /api/dishes/:id - Delete a record
app.delete('/api/dishes/:id', (req, res) => {
  const index = dishes.findIndex(d => String(d.id) === req.params.id);
  if (index === -1) {
    return res.status(404).json({ error: 'Record not found' });
  }

  dishes.splice(index, 1);
  return res.status(204).send();
});

// 404 Handler for unknown routes (always JSON)
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Error-handling middleware (catches malformed JSON and server errors, always JSON)
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ error: 'Malformed JSON in request body' });
  }
  return res.status(400).json({ error: err.message || 'Invalid request' });
});

// Start server
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server listening on port ${PORT}`);
  });
}

module.exports = app;
