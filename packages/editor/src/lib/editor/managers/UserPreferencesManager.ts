import {
	TLUserPreferences,
	defaultUserPreferences,
	userPrefersDarkUI,
} from '../../config/TLUserPreferences'
import { TLUser } from '../../config/createTLUser'

export class UserPreferencesManager {
	constructor(private readonly user: TLUser, private readonly inferDarkMode: boolean) {}

	updateUserPreferences = (userPreferences: Partial<TLUserPreferences>) => {
		this.user.setUserPreferences({
			...this.user.userPreferences.get(),
			...userPreferences,
		})
	}
	getUserPreferences() {
		return {
			id: this.getId(),
			name: this.getName(),
			locale: this.getLocale(),
			color: this.getColor(),
			isDarkMode: this.getIsDarkMode(),
			animationSpeed: this.getAnimationSpeed(),
			isSnapMode: this.getIsSnapMode(),
		}
	}
	getIsDarkMode() {
		return (
			this.user.userPreferences.get().isDarkMode ??
			(this.inferDarkMode ? userPrefersDarkUI() : false)
		)
	}

	/**
	 * The speed at which the user can scroll by dragging toward the edge of the screen.
	 */
	getEdgeScrollSpeed() {
		return this.user.userPreferences.get().edgeScrollSpeed ?? defaultUserPreferences.edgeScrollSpeed
	}

	getAnimationSpeed() {
		return this.user.userPreferences.get().animationSpeed ?? defaultUserPreferences.animationSpeed
	}

	getId() {
		return this.user.userPreferences.get().id
	}

	getName() {
		return this.user.userPreferences.get().name ?? defaultUserPreferences.name
	}

	getLocale() {
		return this.user.userPreferences.get().locale ?? defaultUserPreferences.locale
	}

	getColor() {
		return this.user.userPreferences.get().color ?? defaultUserPreferences.color
	}

	getIsSnapMode() {
		return this.user.userPreferences.get().isSnapMode ?? defaultUserPreferences.isSnapMode
	}
}
