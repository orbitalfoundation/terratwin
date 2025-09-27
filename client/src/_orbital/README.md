# Orbital Foundation Notes

Orbital is an open source agent simulation framework developed with a grant from Futurewei. Conceptually Orbital is less a formal piece of source code and more a set of patterns for agent based systems. See https://orbital.foundation for more details.

The fragment of Orbital used here is an extract of a larger project, just enough to deliver the services we need.

## Orbital Services

1) *Sys* -> Orbital implements a pub/sub architecture as a messaging backbone. The idea is that you publish entities via the global method sys() and then observers can react to those entities. Entities can register their own listeners, and thus entire applications can be bootstrapped simply by publishing declarative entities. This is a key design goal - that we can use declarative patterns to declare complex systems.

2) *Volume* -> Reacts to any entity that has a "volume" property; and renders that entity in 3d to the screen. This enforces a total separation between declarations and presentation.

## Entities

Entities in general are objects that collect behaviors. For example in a fish simulation you may have an entity decorated with a salmon behavior.

