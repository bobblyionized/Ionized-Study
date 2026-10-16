/* ====================== catalog ====================== */
const CATALOG=[
 {area:'AMC 10 Focus',note:'Everything the AMC 10 has tested over the last 20 years (2006–2025), with full proofs, a link to every past exam, and original practice in the same style.',items:[
  {id:'a10',name:'AMC 10: The 20-Year Course',amc:'10',d:'How the test works, an index of all 42 AMC 10 exams from 2006–2025, and every tested topic taught from scratch with proofs and practice.',subs:[
   {id:'a10-guide',name:'How the AMC 10 Works & 20-Year Exam Index',d:'Format, scoring, when to guess, difficulty by problem number, topic mix, and links to every exam since 2006.'},
   {id:'a10-arith',name:'Arithmetic, Percents, Ratios & Rates',d:'Fractions, percent change, ratios, rates and work, averages, units: the core of problems 1–10.'},
   {id:'a10-alg',name:'Equations, Quadratics & Functions',d:'Linear systems, factoring identities, quadratics and Vieta, exponents, absolute value, functions, AM–GM.'},
   {id:'a10-seq',name:'Sequences, Series & Patterns',d:'Arithmetic and geometric sequences, sums, telescoping, recursion and cycles.'},
   {id:'a10-nt',name:'Number Theory',d:'Primes, divisors, gcd and lcm, modular arithmetic, digits and bases, factorials.'},
   {id:'a10-count',name:'Counting',d:'Multiplication principle, permutations, combinations, stars and bars, inclusion–exclusion, casework.'},
   {id:'a10-prob',name:'Probability & Expected Value',d:'Equally likely outcomes, complements, conditional probability, geometric probability, expectation.'},
   {id:'a10-tri',name:'Triangles',d:'Angles, Pythagoras, similarity, special triangles, area formulas, angle bisectors, centers.'},
   {id:'a10-circ',name:'Circles',d:'Inscribed angles, tangents, power of a point, cyclic quadrilaterals, arcs and sectors.'},
   {id:'a10-poly',name:'Polygons, Area & Coordinates',d:'Angle sums, quadrilaterals, regular polygons, shoelace and Pick, lines, distance, reflections.'},
   {id:'a10-3d',name:'3D Geometry',d:'Volume and surface area of prisms, cylinders, pyramids, cones and spheres; space diagonals and cross-sections.'},
   {id:'a10-logic',name:'Logic, Statistics & Puzzles',d:'Mean, median, mode; truth-tellers and liars; games; clocks and calendars; invariants.'}]}]},
 {area:'Algebra',note:'The backbone of both contests: roughly a third of every AMC 10/12.',items:[
  {id:'alg',name:'Algebraic Manipulation & Equations',amc:'10/12',d:'Linear equations and systems, ratios, rates and percents, classic word problems, factoring, radicals.',subs:[
   {id:'alg-lin',name:'Linear Equations & Systems',d:'solving, substitution, elimination, clever combinations of equations'},
   {id:'alg-rate',name:'Ratios, Rates & Percents',d:'ratio scaling, percent change, successive discounts, unit rates'},
   {id:'alg-word',name:'Work, Distance & Mixtures',d:'d = rt, combined work, average speed, concentration problems'},
   {id:'alg-fact',name:'Factoring & Special Products',d:'difference of squares, sum/difference of cubes, grouping, clever expansions'},
   {id:'alg-rad',name:'Radicals & Absolute Value',d:'simplifying radicals, rationalizing, nested radicals, absolute value equations'}]},
  {id:'quad',name:'Quadratics',amc:'10/12',d:'Factoring, the quadratic formula, discriminant, vertex form, and quadratic systems.',subs:[
   {id:'quad-solve',name:'Solving Quadratics',d:'factoring, completing the square, the quadratic formula'},
   {id:'quad-disc',name:'Discriminant & Nature of Roots',d:'real, repeated and complex roots; tangency; integer-root conditions'},
   {id:'quad-vertex',name:'Vertex Form & Optimization',d:'vertex, axis of symmetry, maximum and minimum values'},
   {id:'quad-vieta',name:'Vieta for Quadratics',d:'sum and product of roots, symmetric expressions, building equations from roots'},
   {id:'quad-sys',name:'Quadratic Systems & Intersections',d:'line–parabola intersections, symmetric systems, substitution tricks'}]},
  {id:'func',name:'Functions & Graphs',amc:'10/12',d:'Composition, inverses, transformations, piecewise and floor functions, functional equations.',subs:[
   {id:'func-eval',name:'Evaluation, Domain & Range',d:'plugging in, domains of radicals and fractions, ranges'},
   {id:'func-comp',name:'Composition & Inverses',d:'f(g(x)), iterating functions, finding and using inverses'},
   {id:'func-trans',name:'Transformations & Graphs',d:'shifts, stretches, reflections, even/odd functions, intersections'},
   {id:'func-floor',name:'Piecewise, Floor & Ceiling',d:'piecewise definitions, floor/ceiling equations and sums'},
   {id:'func-feq',name:'Functional Equations',d:'plugging in special values, solving for f(x), periodic relations'}]},
  {id:'polys',name:'Polynomials',amc:'10/12',d:'Vieta, remainder and factor theorems, rational roots, symmetric sums.',subs:[
   {id:'poly-vieta',name:"Vieta's Formulas",d:'sums and products of roots of cubics and quartics'},
   {id:'poly-rem',name:'Remainder & Factor Theorems',d:'p(a) as a remainder, finding unknown coefficients, remainders mod quadratics'},
   {id:'poly-roots',name:'Rational & Integer Roots',d:'rational root theorem, integer roots, conjugate roots'},
   {id:'poly-sym',name:'Symmetric Sums & Newton Sums',d:'power sums of roots, transforming roots, sum of coefficients'},
   {id:'poly-coef',name:'Coefficients & Polynomial Tricks',d:'p(1), p(−1), constructing polynomials, degree arguments'}]},
  {id:'ineq',name:'Inequalities & Optimization',amc:'10/12',d:'Solving inequalities, AM–GM, Cauchy–Schwarz, and max/min problems.',subs:[
   {id:'ineq-solve',name:'Solving Inequalities',d:'linear, quadratic and rational inequalities; sign charts; counting integer solutions'},
   {id:'ineq-amgm',name:'AM–GM',d:'minimizing sums, maximizing products, equality cases'},
   {id:'ineq-cs',name:'Cauchy–Schwarz & QM–AM',d:'bounds on linear expressions, sums of squares'},
   {id:'ineq-abs',name:'Absolute Value & Triangle Inequality',d:'|a|+|b| ≥ |a+b|, sums of distances, triangle side conditions'},
   {id:'ineq-opt',name:'Maximum & Minimum Problems',d:'optimization with constraints, integer optimization'}]},
  {id:'seq',name:'Sequences & Series',amc:'10/12',d:'Arithmetic & geometric sequences, infinite series, sigma notation, telescoping, recursion, Fibonacci, means, and mixed AMC challenges.',subs:[
   {id:'arith',name:'Arithmetic Sequences & Series',d:'nth term, counting terms, sums, Sₙ tricks, middle term, consecutive-integer sums'},
   {id:'geo',name:'Geometric Sequences & Finite Series',d:'nth term, ratio from two terms, finite sums, products, logs → APs'},
   {id:'infgeo',name:'Infinite Geometric Series',d:'a/(1−r), repeating decimals, bouncing balls, nested figures, probability games'},
   {id:'sigma',name:'Sigma Notation & Power Sums',d:'Σk, Σk², Σk³, double sums, alternating & floor sums, hockey stick'},
   {id:'tele',name:'Telescoping Sums & Products',d:'partial fractions, radicals, factorials, log chains, infinite telescoping'},
   {id:'recur',name:'Recursive Sequences & Periodicity',d:'find the period, fixed points, reciprocal & shift substitutions'},
   {id:'fib',name:'Linear Recurrences & Fibonacci',d:'characteristic equations, Fibonacci identities, counting via recursion, Pisano periods'},
   {id:'arigeo',name:'Arithmetico-Geometric Series & Finite Differences',d:'Σk·rᵏ, shift-and-subtract, difference tables, polynomial sequences'},
   {id:'means',name:'Means, Harmonic Sequences & AP/GP Combos',d:'AM–GM–HM, inserting means, harmonic progressions, mixed AP/GP systems'},
   {id:'mixed',name:'AMC Mixed Challenge',d:'Contest-level problems combining every technique, plus a strategy guide'}]},
 ]},
 {area:'Geometry',note:'About a third of each test. Diagrams, angle chasing, and length/area computations.',items:[
  {id:'tri',name:'Triangles',amc:'10/12',d:'Similarity, Pythagorean triples, special triangles, area formulas, cevians, triangle centers.',subs:[
   {id:'tri-angle',name:'Angle Chasing',d:'angle sums, exterior angles, isosceles triangles, parallel lines'},
   {id:'tri-sim',name:'Similar Triangles',d:'AA similarity, ratios of sides and areas, parallel cuts'},
   {id:'tri-pyth',name:'Pythagorean Theorem & Special Triangles',d:'triples, 30-60-90, 45-45-90, altitudes to hypotenuse'},
   {id:'tri-area',name:'Triangle Area Formulas',d:"½bh, Heron's formula, ½ab sin C, rs, abc/4R"},
   {id:'tri-cev',name:'Angle Bisectors, Medians & Cevians',d:"angle bisector theorem, Stewart's theorem, median lengths, centroid"},
   {id:'tri-center',name:'Inradius, Circumradius & Centers',d:'r = A/s, R = abc/4A, right-triangle shortcuts, triangle centers'}]},
  {id:'circ',name:'Circles',amc:'10/12',d:'Inscribed angles, tangents, power of a point, cyclic quadrilaterals, arcs and sectors.',subs:[
   {id:'circ-angle',name:'Inscribed & Central Angles',d:'inscribed angle theorem, angles from chords, secants and tangents'},
   {id:'circ-tan',name:'Tangents & Tangent Circles',d:'equal tangents, tangent ⟂ radius, circles tangent to each other'},
   {id:'circ-pop',name:'Power of a Point & Chords',d:'intersecting chords, secant–secant, tangent–secant, chord distance'},
   {id:'circ-cyc',name:'Cyclic Quadrilaterals',d:"opposite angles, Ptolemy's theorem, Brahmagupta's formula"},
   {id:'circ-arc',name:'Arcs, Sectors & Circular Regions',d:'arc length, sector area, segments, shaded regions'}]},
  {id:'polyg',name:'Polygons & Area',amc:'10/12',d:"Quadrilaterals, regular polygons, shoelace formula, area ratios, Pick's theorem.",subs:[
   {id:'polyg-quad',name:'Quadrilaterals',d:'parallelograms, trapezoids, rhombi, kites, rectangles'},
   {id:'polyg-reg',name:'Regular Polygons',d:'interior/exterior angles, diagonals, hexagons, octagons'},
   {id:'polyg-shoe',name:"Shoelace Formula & Pick's Theorem",d:'areas from coordinates, lattice polygons'},
   {id:'polyg-ratio',name:'Area Ratios & Mass Points',d:'shared heights, cevian ratios, mass points'}]},
  {id:'coord',name:'Coordinate Geometry',amc:'10/12',d:'Lines, distance, circles in the plane, lattice points, reflections and loci.',subs:[
   {id:'coord-line',name:'Lines & Slopes',d:'slope, intercepts, parallel and perpendicular lines, intersections'},
   {id:'coord-dist',name:'Distance, Midpoints & Circles',d:'distance formula, circle equations, point-to-line distance'},
   {id:'coord-lattice',name:'Lattice Points',d:'points on segments, inside shapes, on curves'},
   {id:'coord-trans',name:'Reflections & Transformations',d:'reflections, rotations, shortest paths, regions defined by inequalities'}]},
  {id:'solid',name:'3D Geometry',amc:'10/12',d:'Prisms, cylinders, pyramids, cones, spheres, cross-sections and 3D distances.',subs:[
   {id:'solid-prism',name:'Prisms, Cubes & Cylinders',d:'volume, surface area, space diagonals'},
   {id:'solid-pyr',name:'Pyramids & Cones',d:'volume, slant height, lateral area, frustums'},
   {id:'solid-sphere',name:'Spheres & Inscribed Solids',d:'sphere volume/area, inscribed and circumscribed solids'},
   {id:'solid-dist',name:'3D Distances & Cross-Sections',d:'distance in space, cross-sections, scaling volumes'}]},
 ]},
 {area:'Number Theory',note:'Divisibility, remainders and digits. Often the trickiest problems on the AMC 10.',items:[
  {id:'div',name:'Divisibility, Primes & Factors',amc:'10/12',d:'Prime factorization, counting divisors, gcd/lcm, divisibility rules, factorials.',subs:[
   {id:'div-pf',name:'Prime Factorization & Divisors',d:'number of divisors, sum of divisors, perfect squares and cubes'},
   {id:'div-gcd',name:'GCD & LCM',d:'Euclidean algorithm, gcd·lcm = ab, word problems'},
   {id:'div-rules',name:'Divisibility Rules',d:'rules for 2–11, missing digits, divisibility of expressions'},
   {id:'div-fact',name:"Factorials & Legendre's Formula",d:'trailing zeros, prime powers in n!, divisibility of factorials'}]},
  {id:'mod',name:'Modular Arithmetic',amc:'10/12',d:'Congruences, units digits and cycles, Fermat/Euler, Chinese Remainder Theorem.',subs:[
   {id:'mod-basic',name:'Congruences & Remainders',d:'arithmetic mod n, remainders of sums and products'},
   {id:'mod-cycle',name:'Units Digits & Cycles',d:'last digits of powers, cycle lengths'},
   {id:'mod-fermat',name:"Fermat's Little Theorem & Euler",d:'a^(p−1) ≡ 1, φ(n), large exponents'},
   {id:'mod-crt',name:'Chinese Remainder Theorem & Inverses',d:'systems of congruences, modular inverses, linear congruences'}]},
  {id:'base',name:'Bases & Digits',amc:'10/12',d:'Base conversion, digit sums, place value, repeating decimals.',subs:[
   {id:'base-conv',name:'Base Conversion & Arithmetic',d:'converting between bases, arithmetic in base b, unknown bases'},
   {id:'base-digit',name:'Digit Sums & Place Value',d:'digit equations, reversing digits, digit sums'},
   {id:'base-dec',name:'Terminating & Repeating Decimals',d:'which fractions terminate, period length, decimal digits'}]},
  {id:'dioph',name:'Diophantine Equations & Integers',amc:'10/12',d:"Linear Diophantine equations, Simon's Favorite Factoring Trick, bounding, floor functions.",subs:[
   {id:'dioph-lin',name:'Linear Diophantine Equations',d:'ax + by = c, counting nonnegative solutions, coin problems'},
   {id:'dioph-sfft',name:"Simon's Favorite Factoring Trick",d:'xy + ax + by = c, counting factor pairs'},
   {id:'dioph-bound',name:'Bounding & Case Analysis',d:'squares, parity, size arguments'},
   {id:'dioph-floor',name:'Floor Function Equations',d:'⌊x⌋ equations, counting values, sums of floors'}]},
 ]},
 {area:'Counting & Probability',note:'Systematic counting and probability, which appear throughout both tests.',items:[
  {id:'count',name:'Counting',amc:'10/12',d:'Permutations, combinations, stars and bars, inclusion–exclusion, complementary counting, casework.',subs:[
   {id:'count-basic',name:'Multiplication Principle & Permutations',d:'counting choices, arrangements, permutations with repeated letters'},
   {id:'count-comb',name:'Combinations',d:'choosing committees, paths on grids, subsets'},
   {id:'count-stars',name:'Stars and Bars',d:'distributing identical objects, solutions to x₁+…+xₖ = n'},
   {id:'count-pie',name:'Inclusion–Exclusion & Complements',d:'overlapping sets, "at least one", complementary counting'},
   {id:'count-arr',name:'Arrangements with Restrictions',d:'together/apart, circular arrangements, derangements'}]},
  {id:'prob',name:'Probability',amc:'10/12',d:'Classical and conditional probability, geometric probability, expected value, states.',subs:[
   {id:'prob-basic',name:'Classical Probability',d:'dice, coins, cards, choosing objects'},
   {id:'prob-cond',name:'Conditional Probability & Independence',d:'P(A|B), independent events, Bayes-style problems'},
   {id:'prob-geo',name:'Geometric Probability',d:'probability as length or area ratios'},
   {id:'prob-ev',name:'Expected Value',d:'linearity of expectation, expected counts, fair games'},
   {id:'prob-states',name:'States & Recursion',d:'random walks, first-to-win games, Markov states'}]},
  {id:'binom',name:"Binomial Theorem & Pascal's Triangle",amc:'10/12',d:'Binomial coefficients and identities, expansions, multinomials.',subs:[
   {id:'binom-coef',name:"Binomial Coefficients & Pascal's Triangle",d:'nCk values, Pascal identity, symmetry'},
   {id:'binom-exp',name:'Binomial Expansion',d:'specific coefficients, constant terms, sums of coefficients'},
   {id:'binom-id',name:'Identities & Multinomials',d:'sums of binomial coefficients, Vandermonde, multinomial coefficients'}]},
 ]},
 {area:'Precalculus',note:'Mostly AMC 12 material, with occasional appearances on the AMC 10.',items:[
  {id:'explog',name:'Exponents & Logarithms',amc:'12',d:'Exponent rules, log properties, change of base, exponential equations.',subs:[
   {id:'exp-rules',name:'Exponent Rules & Equations',d:'laws of exponents, matching bases, comparing powers'},
   {id:'log-prop',name:'Logarithm Properties & Change of Base',d:'product/quotient/power rules, change of base, log chains'},
   {id:'log-eq',name:'Log Equations & Number of Digits',d:'solving log equations, digits of large numbers'}]},
  {id:'trig',name:'Trigonometry',amc:'12',d:'Unit circle, identities, laws of sines and cosines, trig equations.',subs:[
   {id:'trig-unit',name:'Unit Circle & Special Angles',d:'exact values, reference angles, radians'},
   {id:'trig-id',name:'Identities & Sum Formulas',d:'Pythagorean, double-angle, sum/difference identities'},
   {id:'trig-law',name:'Law of Sines & Law of Cosines',d:'solving triangles, ½ab sin C'},
   {id:'trig-eq',name:'Trig Equations',d:'counting solutions on an interval, max/min of trig expressions'}]},
  {id:'cplx',name:'Complex Numbers',amc:'12',d:'Arithmetic, modulus, polar form, De Moivre, roots of unity.',subs:[
   {id:'cplx-arith',name:'Arithmetic, Conjugates & Modulus',d:'operations, powers of i, |z|, conjugates'},
   {id:'cplx-polar',name:"Polar Form & De Moivre's Theorem",d:'cis form, multiplying by rotating, powers of complex numbers'},
   {id:'cplx-roots',name:'Roots of Unity',d:'nth roots, sums and products, polygons in the complex plane'}]},
  {id:'conic',name:'Conic Sections & Parametrics',amc:'12',d:'Parabolas, ellipses, hyperbolas, parametric equations, vectors.',subs:[
   {id:'conic-para',name:'Parabolas',d:'focus and directrix, vertex, latus rectum'},
   {id:'conic-ell',name:'Ellipses & Hyperbolas',d:'axes, foci, c² = a² ∓ b², areas'},
   {id:'conic-param',name:'Parametric Equations & Vectors',d:'eliminating the parameter, dot product, vector projections'}]},
 ]},
];
/* General Precalculus: one topic per textbook chapter, one subtopic per section */
const PC_CATALOG=[
 {area:'Chapters',note:'Follows the textbook chapter by chapter. Each section has a full lesson, a 50+ problem set with worked solutions, and a practice mode.',items:[
  {id:'pc3',name:'Functions and Graphs',ch:3,d:'Chapter 3: what a function is, functional notation, graphs, parametric graphing, transformations, symmetry, operations, rates of change, and inverse functions.',subs:[
   {id:'pc3-func',sec:'3.1',name:'Functions',d:'the definition of a function; functions given by tables, graphs, words and equations'},
   {id:'pc3-not',sec:'3.2',name:'Functional Notation',d:'evaluating f(x), difference quotients, domains, piecewise-defined functions, common mistakes'},
   {id:'pc3-graph',sec:'3.3',name:'Graphs of Functions',d:'basic graph shapes, step and piecewise graphs, increasing/decreasing, local maxima and minima, the vertical line test'},
   {id:'pc3-param',sec:'3.3.A',name:'Parametric Graphing',d:'parametric equations, eliminating the parameter, graphing x as a function of y'},
   {id:'pc3-trans',sec:'3.4',name:'Graphs and Transformations',d:'vertical and horizontal shifts, reflections, stretches and compressions, combining them'},
   {id:'pc3-sym',sec:'3.4.A',name:'Symmetry',d:'symmetry about the axes and the origin, even and odd functions'},
   {id:'pc3-ops',sec:'3.5',name:'Operations on Functions',d:'sums, differences, products, quotients, composition, decomposing functions, domains of combinations'},
   {id:'pc3-rate',sec:'3.6',name:'Rates of Change',d:'average rate of change, secant lines, the difference quotient, estimating instantaneous rates'},
   {id:'pc3-inv',sec:'3.7',name:'Inverse Functions',d:'one-to-one functions, the horizontal line test, finding and graphing inverses, the round-trip properties'}]},
  {id:'pc4',name:'Polynomial and Rational Functions',ch:4,d:'Chapter 4: quadratics, polynomial division, the Remainder and Factor Theorems, real roots, polynomial graphs, rational functions, inequalities, complex numbers, and the theory of equations.',subs:[
   {id:'pc4-quad',sec:'4.1',name:'Quadratic Functions',d:'standard and vertex form, the vertex formula, graphs, writing a rule from the vertex, optimization'},
   {id:'pc4-poly',sec:'4.2',name:'Polynomial Functions',d:'degree and coefficients, the Division Algorithm, the Remainder and Factor Theorems, building polynomials from roots'},
   {id:'pc4-synth',sec:'4.2.A',name:'Synthetic Division',d:'dividing by x − c quickly, evaluating polynomials, finding factors'},
   {id:'pc4-roots',sec:'4.3',name:'Real Roots of Polynomials',d:'the Rational Root Test, the Bounds Test, factoring higher-degree polynomials'},
   {id:'pc4-graph',sec:'4.4',name:'Graphs of Polynomial Functions',d:'end behavior, intercepts, multiplicity, turning points, complete graphs'},
   {id:'pc4-model',sec:'4.4.A',name:'Polynomial Models',d:'fitting polynomials to data, finite differences, volume and area optimization models'},
   {id:'pc4-rat',sec:'4.5',name:'Rational Functions',d:'domains, vertical and horizontal asymptotes, holes, intercepts, applied problems'},
   {id:'pc4-ratx',sec:'4.5.A',name:'Other Rational Functions',d:'slant (oblique) asymptotes, numerator degree larger than denominator, polynomial end behavior'},
   {id:'pc4-ineq',sec:'4.6',name:'Polynomial and Rational Inequalities',d:'linear, quadratic, factorable and rational inequalities, sign charts'},
   {id:'pc4-abs',sec:'4.6.A',name:'Absolute Value Inequalities',d:'|x − c| < r and |x − c| > r, distance interpretation, compound inequalities'},
   {id:'pc4-cplx',sec:'4.7',name:'Complex Numbers',d:'arithmetic, powers of i, conjugates and division, square roots of negatives, complex solutions of quadratics'},
   {id:'pc4-theory',sec:'4.8',name:'Theory of Equations',d:'the Fundamental Theorem of Algebra, conjugate roots, factoring completely, building polynomials from complex roots'}]},
 ]},
];
const TRACKS=[
 {id:'amc',name:'AMC 10/12 Prep',cat:CATALOG,d:'Everything on the AMC 10 and AMC 12: 22 topics, lessons, thousands of problems, and full mock exams.'},
 {id:'pc',name:'General Precalculus',cat:PC_CATALOG,d:'A chapter-by-chapter precalculus course: functions and graphs, then polynomial and rational functions.'},
];
const TOPICS=[];const SUBS=[];
for(const tr of TRACKS)for(const sec of tr.cat)for(const t of sec.items){t.area=sec.area;t.track=tr.id;TOPICS.push(t);for(const s of t.subs){s.topic=t.id;SUBS.push(s)}}
const trackOf=t=>TRACKS.find(x=>x.id===t.track);
const amcTopics=()=>TOPICS.filter(t=>t.track==='amc');
const findTopic=id=>TOPICS.find(t=>t.id===id);
const subById=id=>SUBS.find(s=>s.id===id);
