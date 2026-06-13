import utils from "../../utils/utils.ts"

class ui {
    /**
     * @param text Dòng text hiển thị bên dưới icon Loading
     */
    createLoading = (text: string) => {
        const loadingDiv = document.createElement("div");
        loadingDiv.id = "settings-loading";

        const loadingImage = document.createElement('img')
        loadingImage.classList.add("settings-loading-image")
        loadingImage.style.content = "var(--Loading)"

        const loadingText = this.createLabel(text, "settings-loading-text");

        loadingDiv.appendChild(loadingImage);
        loadingDiv.appendChild(loadingText);

        return loadingDiv
    }

    /**
     * Tạo một section trong giao diện cài đặt
     * @param id Id của section
     * @param title Tiêu đề của section
     * @param children Các phần tử con sẽ được thêm vào section này
     * @param show Điều kiện để hiển thị các phần tử con (False = không hiển thị)
     */
    createSection = (id: string, title: string, children: HTMLElement[], show = true) => {
        const content = this.createRow(`${id}-content`, children);
        content.classList.add("theme-settings-section-content");

        const section = this.createRow(id, [
            this.createLabel(title, "", "theme-settings-section-title"),
            content,
        ], show);
        section.classList.add("theme-settings-section");

        return section;
    };

    /**
     * Tạo một div trống
     * @param id Id của 1 div trống
     * @param childs Các phần tử con sẽ được thêm vào div này
     * @param show Điều kiện để hiển thị các phần tử con (False = không hiển thị)
     */
    createRow = (id: string, childs: any, show = true) => {
        const row = document.createElement('div')
        row.classList.add('elaina-theme-settings-row')
        row.id = id
        if (Array.isArray(childs) && show) childs.forEach((el) => row.appendChild(el))
        return row
    }

    /**
     * Giống với row nhưng có thêm nút để ẩn hiện các phần tử con
     * @param id Id của 1 div có thể ẩn hiện
     * @param childs Các phần tử con sẽ được thêm vào div này
     * @param show Điều kiện để hiển thị các phần tử con (False = không hiển thị)
     */
    createRowHideable = (id: string, childs: any, show = true) => {
        const row = document.createElement('div')
        const main = document.createElement('div')
        const hideButtonElement = document.createElement('div')
        const hideButtonIcon = this.createImage(true, "plugins-icons/mediaControllers/next_button.webp", 'elaina-theme-settings-row-hide-icon')

        row.classList.add('elaina-theme-settings-row-hideable')
        row.id = id
        hideButtonElement.id = "elaina-theme-settings-row-hide-button"
        main.setAttribute('isHiding', 'false')

        row.append(hideButtonElement)
        hideButtonElement.append(hideButtonIcon)
        
        row.append(main)

        if (Array.isArray(childs) && show) childs.forEach((el) => main.appendChild(el))

        hideButtonElement.onclick = () => {
            if (main.getAttribute('isHiding') === 'false') {
                main.setAttribute('isHiding', 'true')
                hideButtonIcon.setAttribute("class", 'elaina-theme-settings-row-hide-icon-hidden')
            }
            else {
                main.setAttribute('isHiding', 'false')
                hideButtonIcon.setAttribute("class", 'elaina-theme-settings-row-hide-icon')
            }
        }

        return row
    }

    /**
     * Tạo một label hoặc text 
     * @param text Nội dung của label
     * @param id Id của label
     * @param cls Class của label, mặc định là "Elaina-theme-template-class"
     * @param style Style của label, mặc định là ""
     */
    createLabel = (text: string, id = "", cls = "Elaina-theme-template-class", style = "") => {
        const label = document.createElement('p')

        label.classList.add('lol-settings-window-size-text')
        label.classList.add('elaina-theme-settings-text')
        if (cls.trim()) {
            cls.trim().split(/\s+/).forEach((className) => label.classList.add(className))
        }
        label.id = id
        label.style.cssText = style
        label.innerText = text
        
        return label
    }

    /**
     * Tạo một thẻ img
     * @param localImage Sử dụng ảnh local hay online, mặc định là true
     * @param image Tên của ảnh hoặc đường dẫn đến ảnh, phụ thuộc vào biến localImage
     * @param cls Class của thẻ img
     * @param id Id của thẻ img, mặc định là ""
     * @param style Style của thẻ img, mặc định là ""
     */
    createImage = (localImage: boolean = true, image: string, cls: string, id = "", style = "") => {
        const img = document.createElement('img')

        img.setAttribute("src", localImage ? utils.assets.icon(image) : image)
        img.classList.add(cls)
        img.id = id
        img.style.cssText = style

        return img
    }

    /**
     * Tạo 1 thẻ đường dẫn a
     * @param text Text hiển thị của đường dẫn
     * @param href Đường dẫn đến trang đích
     * @param onClick Hàm sẽ gọi khi người dùng click vào đường dẫn
     * @param id Id của thẻ
     */
    createLink = (text: string, href: string, onClick: any, id = "") => {
        const link = document.createElement('p')
        link.classList.add('lol-settings-code-of-conduct-link')
        link.classList.add('lol-settings-window-size-text')
    
        const a = document.createElement('a')
        a.innerText = text
        a.target = '_blank'
        a.href = href
        a.onclick = onClick || null
        a.download
        a.id = id
    
        link.append(a)
        return link
    }

    /**
     * Là sự kết hợp của Image và Link
     * @param localImage Sử dụng ảnh local hay online, mặc định là true
     * @param image Tên của ảnh hoặc đường dẫn đến ảnh, phụ thuộc vào biến localImage
     * @param cls Class của thẻ img
     * @param href Đường dẫn đến trang đích
     * @param onClick Hàm sẽ gọi khi người dùng click vào ảnh
     */
    createImageWithLink = (localImage: boolean, image: string, cls: string, href: string, onClick: any) => {
        const link = this.createLink("", href, onClick)
        link.setAttribute("class", "")
        link.style.margin = "0px"

        const img = this.createImage(localImage, image, cls, "", "")

        link.querySelector("a")?.append(img)

        return link
    }

    /**
     * Ảnh của những người đóng góp
     * @param localImage Sử dụng ảnh local hay online, mặc định là true
     * @param image Tên của ảnh hoặc đường dẫn đến ảnh, phụ thuộc vào biến localImage
     * @param C_name Tên của người đóng góp
     * @param info Thông tin đóng góp của người đó
     * @param url Đường đẫn đến trang cá nhân của người đó
     */
    createContributor = (localImage: boolean, image: string, C_name: string, info: string, url: string) => {
        const origin = document.createElement("div")
        origin.id = "Contrib"

        const div: any = document.createElement("div")
        div.style.cssText = "margin-left: 10px;"


        const img = this.createImageWithLink(localImage, image, "contributor-img", url, () => {})
        const Name = this.createLabel(C_name, "contributor-name")
        const Info = this.createLabel(info, "", "contributor-info", "margin: 0px")

        origin.append(img)
        origin.append(div)
        div.append(Name)
        div.append(Info)

        return origin
    }

    /**
     * Tạo một nút
     * @param text Nội dung của nút
     * @param cls Class của nút, mặc định là "Elaina-theme-template-class"
     * @param onClick Event sẽ gọi khi người dùng click vào nút
     * @param id Id của nút, mặc định là ""
     * @param style Style của nút, mặc định là ""
     */
    createButton = (text: string, cls = "Elaina-theme-template-class", onClick: any, id = "", style = "") => {
        const btn = document.createElement('lol-uikit-flat-button-secondary')

        btn.innerText = text
        btn.onclick = onClick
        btn.style.cssText = "display: flex;" + style
        btn.setAttribute('class', cls)
        btn.id = id

        return btn
    }

    /**
     * Tạo 1 text box
     * @param Datastore Tến của Datastore, kiểu string
     * @param style Style của text box, mặc định là ""
     * @param onInput Event sẽ gọi khi người dùng nhập vào text box
     */
    createInputElement = (Datastore: string, style = "", onInput: any) => {
        const origin = document.createElement('lol-uikit-flat-input')
        const searchbox = document.createElement('input')
    
        origin.classList.add(Datastore)
        origin.style.cssText = style
    
        searchbox.type = 'url'
        searchbox.name = 'name'
        searchbox.placeholder = ElainaData.get(Datastore)
        searchbox.oninput = onInput

        origin.appendChild(searchbox)
        return { origin, searchbox }
    }

    /**
     * Sử dụng createInputElement để tạo một text box với style và onInput mặc định
     * @param Datastore Tên của Datastore, kiểu string
     */
    createSearchBox = (Datastore: string) => {
        const { origin, searchbox } = this.createInputElement(
            Datastore, 
            "margin-bottom: 12px; width: 190px;", 
            () => {
                let input: any = {
                    get value() {
                        return searchbox.value
                    },
                }
                ElainaData.set(Datastore, input.value)
            }
        )
        return origin
    }

    /**
     * Tạo 1 checkbox
     * @param text Nội dung của checkbox
     * @param id Id của parent chứa checkbox
     * @param boxID Id của checkbox
     * @param check Kiểm tra sự thay đổi của checkbox, sẽ gọi hàm này khi người dùng click vào checkbox
     * @param show Có hiển thị checkbox hay không
     * @param Datastore Tên của Datastore, kiểu string
     */
    createCheckBox = (text: string, id: string, boxID: string, check: any, show: boolean, Datastore: string) => {
        const container = document.createElement("div")
        container.style.width = "fit-content"

        const origin = document.createElement("lol-uikit-flat-checkbox")
        origin.id = id
        origin.setAttribute("lastDatastore", ElainaData.get(Datastore))

        const label = document.createElement("label")
        label.textContent = text
        label.setAttribute("slot", "label")

        const checkbox = document.createElement("input")
        checkbox.type = "checkbox"
        checkbox.id = boxID
        checkbox.setAttribute("slot", "input")
        if (ElainaData.get(Datastore)){
            checkbox.checked = true
            origin.setAttribute("class", "checked")
        }
        else {
            checkbox.checked = false
            origin.setAttribute("class",'')
        }
        checkbox.onclick = () => {
            if (ElainaData.get(Datastore)) {
                origin.removeAttribute("class")
                checkbox.checked = false
                ElainaData.set(Datastore, false)
                check()
            }
            else {
                origin.setAttribute("class", "checked")
                checkbox.checked = true
                ElainaData.set(Datastore, true)
                check()
            }
        }
        
    
        if (show) {
            container.appendChild(origin)
            origin.appendChild(checkbox)
            origin.appendChild(label)
    
            return container
        }
        else {
            const blankDiv = document.createElement("div")
            container.appendChild(blankDiv)
            return container
        }
    }

    /**
     * Tạo 1 thanh kéo (slider) đa năng
     * @param text Nội dung hiển thị
     * @param value Giá trị ban đầu (0-100)
     * @param onChange Hàm gọi khi giá trị thay đổi, nhận value (0-100)
     */
    createSlider = (text: string, value: number, onChange?: (value: number) => void) => {
        const div         = document.createElement("div")
        const title       = document.createElement("div")
        const row         = document.createElement('div')
        const origin: any = document.createElement("lol-uikit-slider")
        const slider      = document.createElement("div")
        const sliderbase  = document.createElement("div")
    
        row.setAttribute("class", "lol-settings-sound-row-slider")
        title.setAttribute("class", "lol-settings-sound-title")
    
        origin.setAttribute("class", "lol-settings-slider")
        origin.setAttribute("value", `${value}`)
        origin.addEventListener("change", () => {
            title.textContent = `${text}: ${origin.value}`
            onChange?.(Number(origin.value))
        })
    
        title.textContent = `${text}: ${value}`
    
        slider.setAttribute("class", "lol-uikit-slider-wrapper horizontal")
        sliderbase.setAttribute("class", "lol-uikit-slider-base")
    
        div.appendChild(title)
        div.appendChild(row)
        row.appendChild(origin)
        origin.appendChild(slider)
        slider.appendChild(sliderbase)
    
        return div
    }

    /**
     * Tạo một dropdown đa năng
     * @param items Danh sách các option, mỗi option có label (hiển thị) và value (giá trị)
     * @param selectedValue Giá trị được chọn hiện tại
     * @param opts Tùy chọn: title, id, datastoreKey, onChange
     */
    createDropdown = (
        items: { label: string, value: any }[],
        selectedValue: any,
        opts: {
            title?: string,
            id?: string,
            datastoreKey?: string,
            onChange?: (item: { label: string, value: any }) => void,
        } = {}
    ) => {
        const origin = document.createElement("div")
        origin.classList.add("Dropdown-div")
        if (opts.id) origin.id = opts.id
        if (opts.datastoreKey) {
            origin.setAttribute("lastDatastore", JSON.stringify(ElainaData.get(opts.datastoreKey)))
        }

        if (opts.title) {
            const title = this.createLabel(opts.title, "")
            origin.append(title)
        }

        const dropdown = document.createElement("lol-uikit-framed-dropdown")
        dropdown.classList.add("lol-settings-general-dropdown")
        origin.append(dropdown)

        for (const item of items) {
            const el = document.createElement("lol-uikit-dropdown-option")
            el.setAttribute("slot", "lol-uikit-dropdown-option")
            el.innerText = item.label
            el.onclick = () => {
                if (opts.datastoreKey) {
                    ElainaData.set(opts.datastoreKey, item.value)
                }
                opts.onChange?.(item)
            }
            // eslint-disable-next-line eqeqeq
            if (selectedValue == item.value) {
                el.setAttribute("selected", "true")
            }
            dropdown.appendChild(el)
        }

        return origin
    }

    /**
     * Tạo một input để người dùng có thể tải lên file
     * @param id Id của input
     * @param acceptFile Loại file được chấp nhận, kiểu string
     * @param onChange Hàm sẽ gọi khi người dùng thay đổi file
     */
    fileInput = (id: string, acceptFile: string, onChange: any) => {
        const input = document.createElement("input")
        input.type = "file"
        input.accept = acceptFile
        input.id = id
        input.onchange = onChange
        input.style.display = "none"

        return input
    }

    /**
     * Tạo một input để người dùng có thể chọn màu sắc
     * @param id Id của input
     * @param targetDataStore Tên của Datastore, kiểu string
     * @param onChange Hàm sẽ gọi khi người dùng thay đổi màu sắc
     */
    colorPicker = (id: string, targetDataStore: string, onChange: any) => {
        const input = document.createElement("input")
        input.type = "color"
        input.id = id
        input.value = ElainaData.get(targetDataStore)
        input.onchange = onChange

        return input
    }

    /**
     * Tạo một thanh trượt để điều chỉnh độ mờ của một phần tử
     * @param id Id của thanh trượt
     * @param text Nội dung của thanh trượt
     * @param opacityHexData độ mờ của phần tử dưới dạng HEX, kiểu string
     * @param onChange Hàm sẽ gọi khi người dùng thay đổi giá trị của thanh trượt
     */
    opacitySlider = (id: string, text: string, opacityHexData: string, onChange: any) => {
        const div        = document.createElement("div")
        const title      = document.createElement("div")
        const row        = document.createElement('div')
        const origin     = document.createElement("lol-uikit-slider")
        const slider     = document.createElement("div")
        const sliderbase = document.createElement("div")
    
        row.setAttribute("class", "lol-settings-sound-row-slider")
        title.setAttribute("class", "lol-settings-sound-title")
        title.id = id+"-title"
    
        origin.id = id
        origin.setAttribute("class", "lol-settings-slider")
        origin.setAttribute("value", `${parseInt(ElainaData.get(opacityHexData).slice(0, 2), 16) / 255 * 100}`)
        origin.addEventListener("change", onChange)
    
        title.textContent = `${text}: ${parseInt(ElainaData.get(opacityHexData).slice(0, 2), 16) / 255 * 100}%`
    
        slider.setAttribute("class", "lol-uikit-slider-wrapper horizontal")
        sliderbase.setAttribute("class", "lol-uikit-slider-base")
    
        div.appendChild(title)
        div.appendChild(row)
        row.appendChild(origin)
        origin.appendChild(slider)
        slider.appendChild(sliderbase)
    
        return div
    }
}

const UI = new ui()

export { UI }
