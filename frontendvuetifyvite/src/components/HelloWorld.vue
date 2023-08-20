<template>
    <v-container>
        <v-row>
            <v-col>
                <v-text-field v-model="url" placeholder="Anna tapahtumasivun url" />
                (DEV) Esim. url: https://www.lippu.fi/artist/ilves/ilves-chl-2022-2023-3202751/
            </v-col>
        </v-row>
        <v-row>
            <v-col>
                <v-btn depressed color="success" @click="loadData">
                    {{ data.length > 0 ? 'Päivitä' : 'Hae tiedot' }}
                 </v-btn>
            </v-col>
        </v-row>
        <div v-if="loaded">
        <v-row class="text-center" v-for="(eventData, index) in data" v-bind:key="index">
            <v-col cols="6">
                <event-card :data="eventData" :id="eventData.eventId" :title="eventData.eventName" />
            </v-col>
            <v-col cols="6">
                <!--<line-chart />-->
            </v-col>
        </v-row>
        </div>
        <v-row class="text-center" v-else>
            <v-col cols="12">
               <v-progress-circular
                    indeterminate
                    color="primary"
                />
            </v-col>
        </v-row>
    </v-container>
</template>

<script>
import axios from 'axios'
//import LineChart from './charts/LineChart.vue'
import EventCard from './EventCard.vue'
export default {
    name: 'HelloWorld',
    components: { 
        //LineChart,
        EventCard
    },
    data() {
        return {
            data: {},
            error: "",
            loaded: true,
            url: ""
        }
    },
    methods: {
        loadData() {
            this.loaded = false
            axios.get('/api/matches', { params: { url: this.url }}).then(response => {
                console.log(response.data)
                this.data = response.data
            })
            .catch(e => {
                console.log(e)
            })
            .finally(() => {
                this.loaded = true
            })
        }
    }
}
</script>
