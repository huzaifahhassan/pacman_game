# dStarLite.py
# ------------
# Licensing Information:  You are free to use or extend these projects for
# educational purposes provided that (1) you do not distribute or publish
# solutions, (2) you retain this notice, and (3) you provide clear
# attribution to UC Berkeley, including a link to http://ai.berkeley.edu.
#
# Attribution Information: The Pacman AI projects were developed at UC Berkeley.
# Q9 (D* Lite in partially known mazes) added for CS-860 Artificial
# Intelligence, NUST.


"""
In dStarLite.py, you will implement the D* Lite incremental search algorithm
(S. Koenig and M. Likhachev, "D* Lite", AAAI 2002 -- implement the BASIC
version given in Figure 3 of the paper / the lecture slides).

D* Lite is used by DStarLiteAgent (dStarLiteAgents.py) to drive Pacman to the
food in a maze whose walls he does not know in advance.
"""

import util

INF = float('inf')


def gridHeuristic(a, b):
    """
    Manhattan distance between grid cells a and b. Admissible and consistent
    for 4-connected unit-cost movement. Do not change.
    """
    return abs(a[0] - b[0]) + abs(a[1] - b[1])


class DStarLite:
    """
    D* Lite planner.

    D* Lite searches BACKWARD, from the goal towards Pacman. g(s) and rhs(s) are
    therefore estimates of the cost from s TO THE GOAL, and the successors used
    in the rhs computation are the cells Pacman could move to from s. On a grid
    every move is reversible, so predecessors and successors of a cell are both
    simply self.belief.neighbors(s).

    Attributes (already set up for you in __init__):
      self.belief   a GridBelief (dStarLiteAgents.py) holding Pacman's CURRENT
                    knowledge of the maze. Use only:
                        self.belief.neighbors(s)  cells adjacent to s
                        self.belief.cost(u, v)    1, or INF if u or v is
                                                  believed to be a wall
      self.sStart   Pacman's current cell. The agent (and the autograder)
                    updates this attribute every time Pacman moves.
      self.sGoal    the goal cell (the food dot)
      self.sLast    Pacman's cell at the time of the last replanning episode
      self.h        the heuristic, called as self.h(a, b)
      self.km       the key modifier k_m
      self.U        the open list, a util.DStarLitePriorityQueue
      self.g, self.rhs
                    dictionaries from cells to values. A cell that is not in
                    the dictionary has value INF, so always READ them with
                    self.getG(s) and self.getRhs(s); WRITE them directly,
                    e.g. self.g[s] = 5.

    IMPORTANT:
      * Take vertices off the open list ONLY with self.U.pop(). Every pop is
        counted as one vertex expansion, and the autograder uses this count.
      * Keys are tuples (k1, k2); Python compares tuples lexicographically,
        which is exactly the key ordering D* Lite needs.
      * Do not read the true walls of the maze (belief._trueWalls). Pacman
        may only plan with what he has observed.
    """

    def __init__(self, belief, start, goal, heuristic=gridHeuristic):
        self.belief = belief
        self.sStart = start
        self.sGoal = goal
        self.sLast = start
        self.h = heuristic
        self.km = 0
        self.g = {}
        self.rhs = {}
        self.U = util.DStarLitePriorityQueue()
        self.initialize()

    # ------------------------------------------------------------------
    # Helpers (provided)
    # ------------------------------------------------------------------
    def getG(self, s):
        return self.g.get(s, INF)

    def getRhs(self, s):
        return self.rhs.get(s, INF)

    # ------------------------------------------------------------------
    # Q9: Your code below
    # ------------------------------------------------------------------
    def calculateKey(self, s):
        """
        Returns the priority key of cell s as a tuple (k1, k2):
            k1 = min(g(s), rhs(s)) + h(s_start, s) + k_m
            k2 = min(g(s), rhs(s))
        """
        "*** YOUR CODE HERE ***"
        util.raiseNotDefined()

    def initialize(self):
        """
        Initialize() from the paper: empty open list, k_m = 0, every g and rhs
        value is INF (an empty dictionary already means this), rhs(s_goal) = 0,
        and insert s_goal into the open list with its key.
        """
        "*** YOUR CODE HERE ***"
        util.raiseNotDefined()

    def updateVertex(self, u):
        """
        UpdateVertex(u) from the paper:
          * if u is not the goal, recompute
                rhs(u) = min over s' in neighbors(u) of [ c(u, s') + g(s') ]
          * remove u from the open list if it is there
          * if u is locally inconsistent (g(u) != rhs(u)), insert it into the
            open list with its current key
        """
        "*** YOUR CODE HERE ***"
        util.raiseNotDefined()

    def computeShortestPath(self):
        """
        ComputeShortestPath() from the paper. Keep expanding vertices while
            U.topKey() < calculateKey(s_start)   OR   rhs(s_start) != g(s_start)
        For each vertex u popped with old key k_old:
          * if k_old < calculateKey(u): u was popped with an out-of-date key;
            re-insert it with its new key
          * else if g(u) > rhs(u) (overconsistent): set g(u) = rhs(u) and
            update all its neighbours
          * else (underconsistent): set g(u) = INF and update u itself and all
            its neighbours

        Hint: read k_old with self.U.topKey() BEFORE calling self.U.pop().
        """
        "*** YOUR CODE HERE ***"
        util.raiseNotDefined()

    def nextStep(self):
        """
        Returns the cell Pacman should move to next: the neighbour s' of
        s_start that minimises c(s_start, s') + g(s').

        Return None if Pacman is already at the goal, or if g(s_start) is INF
        (no path to the goal exists given what Pacman currently knows).
        """
        "*** YOUR CODE HERE ***"
        util.raiseNotDefined()

    def updateEdgeCosts(self, changedCells):
        """
        Called (by the agent / autograder) right after Pacman has moved and his
        sensor has discovered new walls. changedCells is the list of cells that
        have JUST been found to be walls; self.belief already contains them, so
        self.belief.cost(...) already returns the new edge costs.

        Implement the body of the main loop of D* Lite that follows a change in
        edge costs:
          1. k_m = k_m + h(s_last, s_start);  s_last = s_start
          2. for every edge (u, v) whose cost changed, call updateVertex on the
             affected vertex. Think carefully about WHICH cells' rhs-values
             can change when a cell w turns into a wall.
          3. computeShortestPath()
        """
        "*** YOUR CODE HERE ***"
        util.raiseNotDefined()
