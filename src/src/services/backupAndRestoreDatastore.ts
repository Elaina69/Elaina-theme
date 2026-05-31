import { pluginUrl } from "../otherThings.ts"
import { log, error } from '../utils/themeLog.ts';

let datastore_list = (await import(pluginUrl("config/datastoreDefault.js"))).default

/** Imports and restores DataStore backup data from a remote URL or exported object. */
export class BackupRestoreData {
	async importData(url: string): Promise<any> {
		const controller = new AbortController();
		const timeoutId = setTimeout(() => controller.abort(), 7000);
	
		try {
			const res = await fetch(url, { signal: controller.signal });
			if (res.status === 200) {
				let Data = await import(url)
				return Data.default
			} 
			else throw new Error();
		} 
		catch (err: any) {
			let errorMsg = "Can't load default datastore from local: "
			clearTimeout(timeoutId);
			error(errorMsg, err);
			window.Toast.error(errorMsg);
		}
	};

	setDefaultData(list: Object | string, restore: Boolean = false) {
		const data = typeof list === 'string' ? JSON.parse(list) : list;
		for (const [key, value] of Object.entries(data)) {
			if (!ElainaData.has(key)) {
				ElainaData.set(key, value);
				log(`${key} data restored`)
			}
			else if (ElainaData.has(key) && restore) {
				ElainaData.set(key, value);
				log(`${key} data restored`)
			}
		}
	}

	restore = async (force: boolean = false) => {
		if (ElainaData.get("Elaina-Plugins")) {
			this.setDefaultData(datastore_list)
		}
		else if (!ElainaData.get("Elaina-Plugins") || !ElainaData.has("Elaina-Plugins") || force) {
			let restoreData = new Promise((resolve: any, reject) => {
				this.setDefaultData(datastore_list)
				setTimeout(async () => {
					resolve()
					// window.restartClient()
				},5000)
			})
			
			window.Toast.promise(restoreData, {
				loading: 'Restoring default Elaina theme data...',
				success: 'Restore complete!',
				error: ''
			})
		}
	}
}

const backupRestoreData = new BackupRestoreData()
const restoreDefaultDataStore = backupRestoreData.restore
const setDefaultData = backupRestoreData.setDefaultData

export { restoreDefaultDataStore, setDefaultData }
