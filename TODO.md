# TODO

1. Fix display of the plot x-axis
2. See if there is any way at all to use built in operators like +, -, *, /, etc. with the gaussian distribution
3. Improve display of the Gaussian distribution (e.g. show mean+-std)
4. Decide what is easiest to specify for a non-tech user (translate 95% confidence interval to mean+-std)
  a. CONF(2, 12)


When a cell is created and is set to a distribution, sample from the distribution to get a statistical picture of that's cell's possible values (e.g. 1000 samples arranged in a vector)
If that cell is ever changed, traverse the tree and update all "descendant" cells of that modified cell using BFS / toposort

If a cell is created the relates to a cell that has a sampled (e.g. vector) representation, use linalg to compute it's sample representation. Eg. if A1 is set to N(1, 1) and A2 is set to `=A1*5`, A2's vector representation would be 5 * A1's vector representation

What do we do if we have C, which is the product of cells A (which we a vector repr for) and B (which we have a vector repr for?).  Simplest option might be an elementwise product.  But -- there is likely a more mathematically rigorous option that minimizes drift from the true distribution, e.g. something with an outer product + a sum?