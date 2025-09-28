///
/// An event bus pattern that provides several features to help us marshal object behavior:
///
///		- provides a few hardcoded listeners that do some work for us
///
///		- allows callers to register their own listeners
///
///		- see more complete implementation at orbital.foundation for more flexibility
///
///	Usage is that you throw an object at this event bus, and listeners can perform actions on it
///

const entities = []
const observers = []
const ids = {}

function sys(blob) {

	// if blob has an id then remember it
	if(blob.id) {
		if(blob.obliterate) {
			delete ids[blob.id]
		} else {
			ids[blob.id] = blob
		}
	}

	// Entity event? Visit all entities observing this event
	observers.forEach(observer => {
		if(observer.onentity) {
			observer.onentity(blob)
		}
	})

	if(blob.obliterate) {
		return
	}

	// Step event? Visit all entities observing this event
	if(blob.step !== undefined) {
		entities.forEach(entity => {
			if(entity.onstep) {
				entity.onstep(blob.step)
			}
		})
		return
	}

	// Call oninit if any
	if(blob.oninit) {
		console.log("sys: initalizing ",blob.id)
		blob.oninit()
	}

	// Register entity if it has onstep method
	if(blob.onstep) {
		entities.push(blob)
	}

	// Register observer if it has onentity method
	if(blob.onentity) {
		observers.push(blob)
	}

}

sys.ids = ids

export { sys }


